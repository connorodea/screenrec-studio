import ScreenCaptureKit
import CoreMedia
import AVFoundation

/// Single-ownership transfer token for moving a non-`Sendable` `CMSampleBuffer`
/// from the ScreenCaptureKit / AVCaptureSession callback queue into the
/// `ScreenRecorder` actor.
///
/// Sound because exactly one box is created per frame, it is yielded into an
/// ordered `AsyncStream` and consumed by exactly one actor, and the source keeps
/// no alias to the buffer after yielding.
struct SampleBox: @unchecked Sendable {
    let buffer: CMSampleBuffer
}

/// What a capture session produces: the display's pixel size, the screen-frame
/// stream, and (when the mic is available + permitted) the audio-sample stream.
struct CaptureStreams: Sendable {
    let size: PixelSize
    let video: AsyncStream<SampleBox>
    let audio: AsyncStream<SampleBox>?
}

/// Owns the `SCStream` (and optional mic `AVCaptureSession`) and bridges their
/// callback-queue frames into ordered, bounded `AsyncStream<SampleBox>`s.
actor CaptureEngine {
    private var stream: SCStream?
    private var adapter: StreamOutputAdapter?
    private var continuation: AsyncStream<SampleBox>.Continuation?
    private var mic: MicrophoneCapture?
    private let sampleQueue = DispatchQueue(
        label: "com.connorodea.ScreenRecStudio.capture", qos: .userInitiated
    )

    /// Picks the main display, starts capturing it (and the mic, if requested and
    /// permitted), and returns the pixel size plus the frame stream(s) to consume.
    /// Mic is best-effort: if permission is denied or no device exists, `audio` is
    /// nil and we record video-only rather than failing.
    func start(frameRate: Int, showsCursor: Bool, captureMic: Bool) async throws -> CaptureStreams {
        let box = try await Permissions.fetchShareableContent()
        let display = try ShareableContent.mainDisplay(in: box.content)
        let size = ShareableContent.pixelSize(for: display)

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = StreamConfigBuilder(
            pixelWidth: size.width, pixelHeight: size.height,
            frameRate: frameRate, showsCursor: showsCursor, queueDepth: 6
        ).makeConfiguration()

        // Bounded buffer: under back-pressure we keep the freshest frames.
        var sink: AsyncStream<SampleBox>.Continuation!
        let frames = AsyncStream(SampleBox.self, bufferingPolicy: .bufferingNewest(6)) { sink = $0 }

        let adapter = StreamOutputAdapter(continuation: sink)
        let stream = SCStream(filter: filter, configuration: config, delegate: adapter)
        try stream.addStreamOutput(adapter, type: .screen, sampleHandlerQueue: sampleQueue)

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            stream.startCapture { error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }

        self.stream = stream
        self.adapter = adapter
        self.continuation = sink

        let audio = captureMic ? await startMicrophone() : nil
        return CaptureStreams(size: size, video: frames, audio: audio)
    }

    /// Best-effort mic start. Returns the audio stream, or nil if unavailable.
    private func startMicrophone() async -> AsyncStream<SampleBox>? {
        guard await requestMicAccess() else { return nil }
        var sink: AsyncStream<SampleBox>.Continuation!
        let frames = AsyncStream(SampleBox.self, bufferingPolicy: .bufferingNewest(8)) { sink = $0 }
        let mic = MicrophoneCapture(continuation: sink)
        do {
            try mic.start()
            self.mic = mic
            return frames
        } catch {
            sink.finish()
            return nil
        }
    }

    private func requestMicAccess() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .audio)
        default: return false
        }
    }

    /// Stops both sources, then closes the frame streams so consumers drain and exit.
    func stop() async throws {
        mic?.stop()
        mic = nil
        if let stream {
            try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                stream.stopCapture { error in
                    if let error { cont.resume(throwing: error) } else { cont.resume() }
                }
            }
        }
        continuation?.finish()
        stream = nil
        adapter = nil
        continuation = nil
    }
}

/// The `SCStreamOutput`/`SCStreamDelegate` conformer. Runs synchronously on the
/// capture queue, keeps only `.complete` frames, and yields them in order.
/// `@unchecked Sendable` is sound: its single stored property (the continuation)
/// is itself `Sendable` and immutable.
final class StreamOutputAdapter: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    private let continuation: AsyncStream<SampleBox>.Continuation

    init(continuation: AsyncStream<SampleBox>.Continuation) {
        self.continuation = continuation
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen,
              sampleBuffer.isValid,
              CMSampleBufferDataIsReady(sampleBuffer) else { return }

        // Keep only frames whose status is `.complete`; skip idle/blank repeats.
        guard let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false)
                as? [[SCStreamFrameInfo: Any]],
              let rawStatus = attachments.first?[.status] as? Int,
              let status = SCFrameStatus(rawValue: rawStatus),
              status == .complete else { return }

        continuation.yield(SampleBox(buffer: sampleBuffer))
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        continuation.finish()
    }
}

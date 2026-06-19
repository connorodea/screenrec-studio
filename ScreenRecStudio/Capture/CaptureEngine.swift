import ScreenCaptureKit
import CoreMedia

/// Single-ownership transfer token for moving a non-`Sendable` `CMSampleBuffer`
/// from the ScreenCaptureKit callback queue into the `ScreenRecorder` actor.
///
/// Sound because exactly one box is created per frame, it is yielded into an
/// ordered `AsyncStream` and consumed by exactly one actor, and the adapter keeps
/// no alias to the buffer after yielding.
struct SampleBox: @unchecked Sendable {
    let buffer: CMSampleBuffer
}

/// Owns the `SCStream` and bridges its callback-queue frames into an ordered,
/// bounded `AsyncStream<SampleBox>` for the recorder to consume.
actor CaptureEngine {
    private var stream: SCStream?
    private var adapter: StreamOutputAdapter?
    private var continuation: AsyncStream<SampleBox>.Continuation?
    private let sampleQueue = DispatchQueue(
        label: "com.connorodea.ScreenRecStudio.capture", qos: .userInitiated
    )

    /// Picks the main display, starts capturing it, and returns its backing-pixel
    /// size (so the writer matches exactly) plus the frame stream to consume.
    func start(frameRate: Int, showsCursor: Bool) async throws -> (size: PixelSize, frames: AsyncStream<SampleBox>) {
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
        return (size, frames)
    }

    /// Stops the stream first (no more frames), then closes the frame stream so the
    /// consumer drains and exits.
    func stop() async throws {
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

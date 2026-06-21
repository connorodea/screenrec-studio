import AVFoundation

/// Microphone capture via `AVCaptureSession`. Delivers audio `CMSampleBuffer`s —
/// host-clock timestamped, same timeline as the screen frames — as `SampleBox`
/// values into an ordered `AsyncStream`, mirroring the screen-capture path.
///
/// `@unchecked Sendable` is sound: the mutable `AVCaptureSession` is only
/// configured/started/stopped from its single owner (`CaptureEngine`, an actor),
/// and the only state touched on the delegate queue is the immutable, `Sendable`
/// continuation.
final class MicrophoneCapture: NSObject, AVCaptureAudioDataOutputSampleBufferDelegate, @unchecked Sendable {
    private let session = AVCaptureSession()
    private let output = AVCaptureAudioDataOutput()
    private let queue = DispatchQueue(label: "com.connorodea.ScreenRecStudio.mic", qos: .userInitiated)
    private let continuation: AsyncStream<SampleBox>.Continuation

    init(continuation: AsyncStream<SampleBox>.Continuation) {
        self.continuation = continuation
        super.init()
    }

    /// Configures and starts the mic session. Throws if there's no input device or
    /// the session can't be wired; the caller degrades to video-only.
    func start() throws {
        guard let device = AVCaptureDevice.default(for: .audio) else {
            throw CaptureError.noMicrophone
        }
        let input = try AVCaptureDeviceInput(device: device)

        session.beginConfiguration()
        guard session.canAddInput(input) else {
            session.commitConfiguration()
            throw CaptureError.noMicrophone
        }
        session.addInput(input)

        output.setSampleBufferDelegate(self, queue: queue)
        guard session.canAddOutput(output) else {
            session.commitConfiguration()
            throw CaptureError.noMicrophone
        }
        session.addOutput(output)
        session.commitConfiguration()

        session.startRunning()
    }

    func stop() {
        session.stopRunning()
        continuation.finish()
    }

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard CMSampleBufferDataIsReady(sampleBuffer) else { return }
        continuation.yield(SampleBox(buffer: sampleBuffer))
    }
}

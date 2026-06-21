import AVFoundation

/// Webcam capture via `AVCaptureSession`. Delivers camera `CMSampleBuffer`s
/// (host-clock timestamped, same timeline as the screen + mic) as `SampleBox`
/// values into an ordered `AsyncStream`, mirroring `MicrophoneCapture`.
///
/// NOTE: this source is built and unit-covered at the seams (`CameraSettings`,
/// `PiPLayout`) but is not yet wired into the recording. Compositing the webcam
/// bubble onto the screen frames is a later, visually-verified sprint; this stages
/// the capture half so that sprint only has to add the GPU compositing.
///
/// `@unchecked Sendable` is sound for the same reason as the mic source: the
/// `AVCaptureSession` is driven from a single owner and the only state touched on
/// the delegate queue is the immutable, `Sendable` continuation.
final class WebcamCapture: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
    private let session = AVCaptureSession()
    private let output = AVCaptureVideoDataOutput()
    private let queue = DispatchQueue(label: "com.connorodea.ScreenRecStudio.webcam", qos: .userInitiated)
    private let continuation: AsyncStream<SampleBox>.Continuation
    private let settings: CameraSettings

    init(settings: CameraSettings, continuation: AsyncStream<SampleBox>.Continuation) {
        self.settings = settings
        self.continuation = continuation
        super.init()
    }

    /// Configures and starts the camera session. Throws if there's no device or the
    /// session can't be wired; the caller degrades to no-webcam.
    func start() throws {
        guard let device = AVCaptureDevice.default(for: .video) else {
            throw CaptureError.noCamera
        }
        let input = try AVCaptureDeviceInput(device: device)

        session.beginConfiguration()
        if session.canSetSessionPreset(settings.sessionPreset) {
            session.sessionPreset = settings.sessionPreset
        }
        guard session.canAddInput(input) else {
            session.commitConfiguration()
            throw CaptureError.noCamera
        }
        session.addInput(input)

        output.videoSettings = settings.videoOutputSettings
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: queue)
        guard session.canAddOutput(output) else {
            session.commitConfiguration()
            throw CaptureError.noCamera
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

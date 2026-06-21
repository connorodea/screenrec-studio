import AVFoundation
import CoreVideo

/// Webcam capture configuration: a quality preset plus the pixel format we feed
/// the compositor/writer. Pure value type (`Sendable`) so the preset mapping and
/// output dictionary are unit-testable without a camera.
struct CameraSettings: Sendable {
    enum Quality: Sendable {
        case vga, hd720, hd1080
    }

    var quality: Quality

    init(quality: Quality = .hd720) {
        self.quality = quality
    }

    /// The `AVCaptureSession` preset for the chosen quality.
    var sessionPreset: AVCaptureSession.Preset {
        switch quality {
        case .vga:    return .vga640x480
        case .hd720:  return .hd1280x720
        case .hd1080: return .hd1920x1080
        }
    }

    /// 32-bit BGRA — matches the screen pixel format, ready for compositing.
    var pixelFormat: OSType { kCVPixelFormatType_32BGRA }

    /// The `videoSettings` dictionary for an `AVCaptureVideoDataOutput`.
    var videoOutputSettings: [String: Any] {
        [kCVPixelBufferPixelFormatTypeKey as String: pixelFormat]
    }
}

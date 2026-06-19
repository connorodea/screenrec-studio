import Foundation
import CoreGraphics

/// Errors surfaced by the capture pipeline. Mapped to `RecordingState.error`
/// (user-facing strings) by `RecordingCoordinator`.
enum CaptureError: Error, LocalizedError {
    case permissionDenied
    case noDisplays
    case noShareableContent
    case noMicrophone

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Screen Recording permission is required. Grant it in System Settings ▸ "
                + "Privacy & Security ▸ Screen Recording, then try again."
        case .noDisplays:
            return "No displays are available to capture."
        case .noShareableContent:
            return "Could not read the list of capturable displays."
        case .noMicrophone:
            return "No microphone is available."
        }
    }
}

/// Errors from the `AVAssetWriter` recording pipeline.
enum RecorderError: Error, LocalizedError {
    case cannotAddInput
    case notRecording
    case noFramesCaptured
    case finishFailed(String)

    var errorDescription: String? {
        switch self {
        case .cannotAddInput:    return "Could not configure the video output."
        case .notRecording:      return "No recording is in progress."
        case .noFramesCaptured:  return "No frames were captured."
        case .finishFailed(let why): return "Could not finalize the recording: \(why)"
        }
    }
}

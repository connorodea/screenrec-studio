import ScreenCaptureKit
import CoreGraphics

/// Screen Recording permission helpers.
///
/// ScreenCaptureKit has no dedicated "request permission" call — *fetching*
/// shareable content is itself the TCC gate, so `fetchShareableContent()` both
/// requests and reads the content. `CGPreflightScreenCaptureAccess()` lets us
/// tell a permission failure apart from other capture failures after the fact.
/// Single-ownership transfer token for the non-`Sendable` `SCShareableContent`,
/// so it can cross from the completion-handler callback into the consuming actor.
/// Sound because exactly one box is produced per fetch and unwrapped by one actor.
struct ShareableContentBox: @unchecked Sendable {
    let content: SCShareableContent
}

enum Permissions {

    /// Fetches the current shareable content (macOS 13.0-safe: completion-handler
    /// form wrapped in a continuation; the async `.current` property is 14.0+).
    /// Returns a transfer box; the calling actor unwraps `.content`.
    static func fetchShareableContent() async throws -> ShareableContentBox {
        try await withCheckedThrowingContinuation { continuation in
            SCShareableContent.getWithCompletionHandler { content, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let content {
                    continuation.resume(returning: ShareableContentBox(content: content))
                } else {
                    continuation.resume(throwing: CaptureError.noShareableContent)
                }
            }
        }
    }

    /// Whether the app currently holds Screen Recording permission.
    static var hasScreenRecordingAccess: Bool {
        CGPreflightScreenCaptureAccess()
    }

    /// Deep link to System Settings ▸ Privacy & Security ▸ Screen Recording.
    static let settingsURL = URL(
        string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    )!
}

import ScreenCaptureKit
import CoreGraphics

/// A backing-pixel size. Distinct from a point size so we never confuse the two.
struct PixelSize: Sendable, Equatable {
    let width: Int
    let height: Int
}

/// Helpers for choosing what to capture and sizing it correctly.
enum ShareableContent {

    /// The main display, falling back to the first available display.
    static func mainDisplay(in content: SCShareableContent) throws -> SCDisplay {
        let main = content.displays.first { $0.displayID == CGMainDisplayID() }
        guard let display = main ?? content.displays.first else {
            throw CaptureError.noDisplays
        }
        return display
    }

    /// Retina-correct backing-pixel size, derived from the active `CGDisplayMode`
    /// (NOT `SCDisplay.width/height`, which are points). Falls back to the point
    /// size only if the display mode is unavailable.
    static func pixelSize(for display: SCDisplay) -> PixelSize {
        if let mode = CGDisplayCopyDisplayMode(display.displayID) {
            return PixelSize(width: mode.pixelWidth, height: mode.pixelHeight)
        }
        return PixelSize(width: display.width, height: display.height)
    }
}

import ScreenCaptureKit
import CoreMedia
import CoreVideo
import CoreGraphics

/// Builds an `SCStreamConfiguration` from plain capture parameters.
///
/// Only macOS 13.0-safe fields are set (width/height/minimumFrameInterval/
/// pixelFormat/showsCursor/queueDepth/colorSpaceName/scalesToFit). Newer fields
/// such as `captureResolution` or `pointPixelScale` (14.0+) are deliberately
/// avoided. The derived scalars are exposed so they can be unit-tested without a
/// live stream.
///
/// IMPORTANT: `pixelWidth`/`pixelHeight` are **backing pixels** (computed from the
/// display's `CGDisplayMode`), not points — see `ShareableContent.pixelSize(for:)`.
struct StreamConfigBuilder {
    var pixelWidth: Int
    var pixelHeight: Int
    var frameRate: Int
    var showsCursor: Bool
    var queueDepth: Int

    /// Frame-rate cap expressed as the minimum interval between frames.
    var minimumFrameInterval: CMTime {
        CMTime(value: 1, timescale: CMTimeScale(frameRate))
    }

    /// 32-bit BGRA — what we feed the H.264 writer.
    var pixelFormat: OSType { kCVPixelFormatType_32BGRA }

    func makeConfiguration() -> SCStreamConfiguration {
        let config = SCStreamConfiguration()
        config.width = pixelWidth
        config.height = pixelHeight
        config.minimumFrameInterval = minimumFrameInterval
        config.pixelFormat = pixelFormat
        config.showsCursor = showsCursor
        config.queueDepth = queueDepth
        config.colorSpaceName = CGColorSpace.sRGB
        config.scalesToFit = false
        return config
    }
}

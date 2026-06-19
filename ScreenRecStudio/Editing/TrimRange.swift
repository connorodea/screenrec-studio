import Foundation
import CoreMedia

/// An in/out trim selection on a recording, always normalized to the asset:
/// both points are clamped to `[0, assetDuration]` and ordered so `start <= end`.
///
/// Pure value type so the clamping and `CMTimeRange` conversion are unit-testable
/// without an `AVAsset`; the export/composition step consumes `cmTimeRange()`.
struct TrimRange: Sendable, Equatable {
    let start: TimeInterval
    let end: TimeInterval

    /// Clamps `start`/`end` into `[0, assetDuration]` and orders them.
    init(start: TimeInterval, end: TimeInterval, assetDuration: TimeInterval) {
        let lo = max(0, min(start, assetDuration))
        let hi = max(0, min(end, assetDuration))
        self.start = min(lo, hi)
        self.end = max(lo, hi)
    }

    /// The whole asset, `[0, assetDuration]`.
    static func full(_ assetDuration: TimeInterval) -> TrimRange {
        TrimRange(start: 0, end: assetDuration, assetDuration: assetDuration)
    }

    var duration: TimeInterval { end - start }

    var isEmpty: Bool { duration <= 0 }

    func contains(_ time: TimeInterval) -> Bool {
        time >= start && time <= end
    }

    /// The selection as a `CMTimeRange` for `AVAssetExportSession.timeRange` /
    /// `AVMutableComposition.insertTimeRange`.
    func cmTimeRange(timescale: CMTimeScale = 600) -> CMTimeRange {
        CMTimeRange(
            start: CMTime(seconds: start, preferredTimescale: timescale),
            duration: CMTime(seconds: duration, preferredTimescale: timescale)
        )
    }
}

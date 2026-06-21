import Foundation
import CoreGraphics

/// A pointer click during a recording — the primary signal for where attention is.
struct ClickEvent: Sendable, Equatable {
    var time: TimeInterval
    var point: CGPoint
}

/// A planned zoom: from `start` to `end` (seconds), zoom to `scale` centered on
/// `focus` (in canvas pixels). Outside any segment the view is at scale 1.
struct ZoomSegment: Sendable, Equatable {
    var start: TimeInterval
    var end: TimeInterval
    var scale: Double
    var focus: CGPoint
}

/// Tunables for the auto-zoom heuristic.
struct AutoZoomConfig: Sendable {
    /// How far to zoom in on activity.
    var scale: Double
    /// Begin the zoom this long before a click.
    var leadIn: TimeInterval
    /// Hold the zoom this long after a click.
    var holdAfter: TimeInterval
    /// Clicks whose windows are within this gap merge into one segment.
    var mergeGap: TimeInterval
    /// Discard segments shorter than this.
    var minDuration: TimeInterval

    init(
        scale: Double = 2.0,
        leadIn: TimeInterval = 0.3,
        holdAfter: TimeInterval = 1.5,
        mergeGap: TimeInterval = 0.8,
        minDuration: TimeInterval = 0.5
    ) {
        self.scale = scale
        self.leadIn = leadIn
        self.holdAfter = holdAfter
        self.mergeGap = mergeGap
        self.minDuration = minDuration
    }
}

/// Plans automatic cursor-zoom segments from click activity — the Screen Studio–style
/// "zoom into what the user is doing" effect, computed as pure data so it can be unit
/// tested and later applied by the compositor/export step.
enum AutoZoomPlanner {

    /// Each click opens an interest window `[t-leadIn, t+holdAfter]`; nearby windows
    /// merge into a single segment focused on the mean click location (clamped so the
    /// zoomed viewport stays inside the canvas). Segments shorter than `minDuration`
    /// are dropped. Output is time-sorted and non-overlapping.
    static func plan(
        clicks: [ClickEvent], canvas: PixelSize, config: AutoZoomConfig = .init()
    ) -> [ZoomSegment] {
        guard !clicks.isEmpty else { return [] }
        let sorted = clicks.sorted { $0.time < $1.time }

        struct Cluster { var start: TimeInterval; var end: TimeInterval; var points: [CGPoint] }
        var clusters: [Cluster] = []

        for click in sorted {
            let windowStart = click.time - config.leadIn
            let windowEnd = click.time + config.holdAfter
            if var last = clusters.last, windowStart <= last.end + config.mergeGap {
                last.end = max(last.end, windowEnd)
                last.points.append(click.point)
                clusters[clusters.count - 1] = last
            } else {
                clusters.append(Cluster(start: windowStart, end: windowEnd, points: [click.point]))
            }
        }

        return clusters.compactMap { cluster in
            let start = max(0, cluster.start)
            let end = cluster.end
            guard end - start >= config.minDuration else { return nil }
            let focus = clampFocus(meanPoint(cluster.points), scale: config.scale, canvas: canvas)
            return ZoomSegment(start: start, end: end, scale: config.scale, focus: focus)
        }
    }

    /// Clamps `focus` so a viewport of size `canvas / scale` centered on it stays
    /// inside the canvas. At `scale <= 1` the viewport is at least the canvas, so the
    /// focus is forced to the center.
    static func clampFocus(_ focus: CGPoint, scale: Double, canvas: PixelSize) -> CGPoint {
        let w = Double(canvas.width)
        let h = Double(canvas.height)
        let halfW = (w / scale) / 2
        let halfH = (h / scale) / 2
        return CGPoint(
            x: clamp(Double(focus.x), low: halfW, high: w - halfW),
            y: clamp(Double(focus.y), low: halfH, high: h - halfH)
        )
    }

    private static func clamp(_ value: Double, low: Double, high: Double) -> Double {
        // Viewport larger than the canvas (low > high) → collapse to the center.
        guard low <= high else { return (low + high) / 2 }
        return min(max(value, low), high)
    }

    private static func meanPoint(_ points: [CGPoint]) -> CGPoint {
        guard !points.isEmpty else { return .zero }
        let sx = points.reduce(0.0) { $0 + Double($1.x) }
        let sy = points.reduce(0.0) { $0 + Double($1.y) }
        return CGPoint(x: sx / Double(points.count), y: sy / Double(points.count))
    }
}

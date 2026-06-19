import Foundation
import CoreGraphics

/// A timed cursor position.
struct CursorSample: Sendable, Equatable {
    var time: TimeInterval
    var point: CGPoint
}

/// Smooths a noisy cursor path into fluid motion (the Screen Studio–style buttery
/// pan), so the auto-zoom focus eases instead of snapping. Pure exponential moving
/// average, so it's deterministic and unit-testable; the compositor consumes the
/// smoothed path.
struct CursorSmoother: Sendable {
    /// 0…1. Higher = snappier (1 = no smoothing); lower = smoother (0 = frozen on
    /// the first point). Values outside the range are clamped.
    var smoothingFactor: Double

    func smooth(_ samples: [CursorSample]) -> [CursorSample] {
        guard let first = samples.first else { return [] }
        let f = min(max(smoothingFactor, 0), 1)

        var result: [CursorSample] = [first]
        result.reserveCapacity(samples.count)
        var previous = first.point

        for sample in samples.dropFirst() {
            let current = sample.point
            let smoothed = CGPoint(
                x: previous.x + CGFloat(f) * (current.x - previous.x),
                y: previous.y + CGFloat(f) * (current.y - previous.y)
            )
            result.append(CursorSample(time: sample.time, point: smoothed))
            previous = smoothed
        }
        return result
    }
}

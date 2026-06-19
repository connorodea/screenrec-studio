import XCTest
import CoreGraphics
@testable import ScreenRecStudio

final class AutoZoomPlannerTests: XCTestCase {

    private let canvas = PixelSize(width: 1000, height: 1000)
    private let config = AutoZoomConfig()   // scale 2, leadIn 0.3, holdAfter 1.5, mergeGap 0.8, minDuration 0.5

    private func click(_ t: TimeInterval, _ x: Double, _ y: Double) -> ClickEvent {
        ClickEvent(time: t, point: CGPoint(x: x, y: y))
    }

    // MARK: - empty / trivial

    func testNoClicksProducesNoZoom() {
        XCTAssertTrue(AutoZoomPlanner.plan(clicks: [], canvas: canvas, config: config).isEmpty)
    }

    func testSingleCentralClickProducesOneSegment() {
        let segments = AutoZoomPlanner.plan(clicks: [click(5.0, 500, 500)], canvas: canvas, config: config)
        XCTAssertEqual(segments.count, 1)
        let s = segments[0]
        XCTAssertEqual(s.start, 4.7, accuracy: 1e-9)   // 5.0 - leadIn 0.3
        XCTAssertEqual(s.end, 6.5, accuracy: 1e-9)     // 5.0 + holdAfter 1.5
        XCTAssertEqual(s.scale, 2.0, accuracy: 1e-9)
        XCTAssertEqual(s.focus.x, 500, accuracy: 1e-9)
        XCTAssertEqual(s.focus.y, 500, accuracy: 1e-9)
    }

    // MARK: - focus clamping (keep the zoomed viewport inside the canvas)

    func testCornerClickFocusIsClampedInward() {
        let segments = AutoZoomPlanner.plan(clicks: [click(5.0, 0, 0)], canvas: canvas, config: config)
        // scale 2 → viewport 500x500 → half 250 → focus clamps to (250,250)
        XCTAssertEqual(segments[0].focus.x, 250, accuracy: 1e-9)
        XCTAssertEqual(segments[0].focus.y, 250, accuracy: 1e-9)
    }

    func testClampFocusKeepsViewportInsideCanvas() {
        XCTAssertEqual(AutoZoomPlanner.clampFocus(CGPoint(x: 500, y: 500), scale: 2, canvas: canvas),
                       CGPoint(x: 500, y: 500))
        XCTAssertEqual(AutoZoomPlanner.clampFocus(CGPoint(x: 0, y: 0), scale: 2, canvas: canvas),
                       CGPoint(x: 250, y: 250))
        XCTAssertEqual(AutoZoomPlanner.clampFocus(CGPoint(x: 9999, y: 9999), scale: 2, canvas: canvas),
                       CGPoint(x: 750, y: 750))
    }

    func testClampFocusAtScaleOneCentersFocus() {
        // viewport == canvas → only the exact center keeps it inside
        XCTAssertEqual(AutoZoomPlanner.clampFocus(CGPoint(x: 300, y: 700), scale: 1, canvas: canvas),
                       CGPoint(x: 500, y: 500))
    }

    // MARK: - merging

    func testNearbyClicksMergeIntoOneSegmentCenteredOnTheCluster() {
        let segments = AutoZoomPlanner.plan(
            clicks: [click(5.0, 400, 400), click(5.5, 600, 600)], canvas: canvas, config: config
        )
        XCTAssertEqual(segments.count, 1)
        XCTAssertEqual(segments[0].start, 4.7, accuracy: 1e-9)
        XCTAssertEqual(segments[0].end, 7.0, accuracy: 1e-9)   // 5.5 + 1.5
        XCTAssertEqual(segments[0].focus.x, 500, accuracy: 1e-9) // mean of 400,600
        XCTAssertEqual(segments[0].focus.y, 500, accuracy: 1e-9)
    }

    func testDistantClicksProduceSeparateSegments() {
        let segments = AutoZoomPlanner.plan(
            clicks: [click(5.0, 300, 300), click(20.0, 700, 700)], canvas: canvas, config: config
        )
        XCTAssertEqual(segments.count, 2)
        // sorted, non-overlapping
        XCTAssertLessThanOrEqual(segments[0].end, segments[1].start)
    }

    // MARK: - edge handling

    func testStartTimeClampedToZero() {
        let segments = AutoZoomPlanner.plan(clicks: [click(0.1, 500, 500)], canvas: canvas, config: config)
        XCTAssertEqual(segments[0].start, 0.0, accuracy: 1e-9) // max(0, 0.1 - 0.3)
    }

    func testSegmentsShorterThanMinDurationAreDropped() {
        let tiny = AutoZoomConfig(scale: 2, leadIn: 0, holdAfter: 0.1, mergeGap: 0.8, minDuration: 0.5)
        let segments = AutoZoomPlanner.plan(clicks: [click(5.0, 500, 500)], canvas: canvas, config: tiny)
        XCTAssertTrue(segments.isEmpty) // 0.1s window < 0.5s minimum
    }

    // MARK: - Sendable

    func testTypesAreSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(AutoZoomConfig())
        requireSendable(ClickEvent(time: 0, point: .zero))
        requireSendable(ZoomSegment(start: 0, end: 1, scale: 2, focus: .zero))
    }
}

import XCTest
import CoreGraphics
@testable import ScreenRecStudio

final class PiPLayoutTests: XCTestCase {

    // 1000x1000 canvas, 20% bubble, 50px margin → 200x200 bubble.
    private let canvas = PixelSize(width: 1000, height: 1000)

    private func layout(_ corner: PiPCorner) -> PiPLayout {
        PiPLayout(corner: corner, sizeFraction: 0.2, margin: 50)
    }

    // MARK: - bubble size

    func testBubbleIsSquareSizedToHeightFraction() {
        let f = layout(.topLeft).frame(in: canvas)
        XCTAssertEqual(f.width, 200)
        XCTAssertEqual(f.height, 200)
    }

    func testBubbleSizeScalesWithCanvasHeight() {
        let tall = PixelSize(width: 1000, height: 2000)
        XCTAssertEqual(layout(.topLeft).frame(in: tall).height, 400) // 2000 * 0.2
    }

    // MARK: - corner placement (origin top-left, +y down)

    func testTopLeftHasMarginOrigin() {
        let f = layout(.topLeft).frame(in: canvas)
        XCTAssertEqual(f.minX, 50)
        XCTAssertEqual(f.minY, 50)
    }

    func testTopRightHugsRightEdge() {
        let f = layout(.topRight).frame(in: canvas)
        XCTAssertEqual(f.minX, 1000 - 200 - 50) // 750
        XCTAssertEqual(f.minY, 50)
    }

    func testBottomLeftHugsBottomEdge() {
        let f = layout(.bottomLeft).frame(in: canvas)
        XCTAssertEqual(f.minX, 50)
        XCTAssertEqual(f.minY, 1000 - 200 - 50) // 750
    }

    func testBottomRightHugsBothFarEdges() {
        let f = layout(.bottomRight).frame(in: canvas)
        XCTAssertEqual(f.minX, 750)
        XCTAssertEqual(f.minY, 750)
    }

    // MARK: - invariants

    func testBubbleAlwaysStaysWithinCanvas() {
        for corner in PiPCorner.allCases {
            let f = layout(corner).frame(in: canvas)
            XCTAssertGreaterThanOrEqual(f.minX, 0)
            XCTAssertGreaterThanOrEqual(f.minY, 0)
            XCTAssertLessThanOrEqual(f.maxX, 1000)
            XCTAssertLessThanOrEqual(f.maxY, 1000)
        }
    }

    func testOversizedBubbleClampsToCanvasMinusMargins() {
        // 200% fraction would overflow; expect it clamped so it still fits.
        let huge = PiPLayout(corner: .topLeft, sizeFraction: 2.0, margin: 50)
        let f = huge.frame(in: canvas)
        XCTAssertLessThanOrEqual(f.maxX, 1000)
        XCTAssertLessThanOrEqual(f.maxY, 1000)
        XCTAssertGreaterThan(f.width, 0)
    }

    // MARK: - circular crop

    func testCircularCropIsTheSquareBubbleItself() {
        let f = layout(.bottomRight).frame(in: canvas)
        let crop = layout(.bottomRight).circularCropRect(in: canvas)
        XCTAssertEqual(crop, f) // bubble is already square
    }

    // MARK: - Sendable

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(layout(.topRight))
    }
}

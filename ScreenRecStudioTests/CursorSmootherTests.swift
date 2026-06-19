import XCTest
import CoreGraphics
@testable import ScreenRecStudio

final class CursorSmootherTests: XCTestCase {

    private func sample(_ t: TimeInterval, _ x: Double, _ y: Double) -> CursorSample {
        CursorSample(time: t, point: CGPoint(x: x, y: y))
    }

    private func assertPoint(_ p: CGPoint, _ x: Double, _ y: Double, line: UInt = #line) {
        XCTAssertEqual(Double(p.x), x, accuracy: 1e-9, line: line)
        XCTAssertEqual(Double(p.y), y, accuracy: 1e-9, line: line)
    }

    // MARK: - trivial

    func testEmptyReturnsEmpty() {
        XCTAssertTrue(CursorSmoother(smoothingFactor: 0.5).smooth([]).isEmpty)
    }

    func testSingleSampleUnchanged() {
        let out = CursorSmoother(smoothingFactor: 0.5).smooth([sample(0, 3, 4)])
        XCTAssertEqual(out.count, 1)
        assertPoint(out[0].point, 3, 4)
    }

    // MARK: - EMA behavior

    func testFactorHalfIsExponentialMovingAverage() {
        let input = [sample(0, 0, 0), sample(1, 10, 0), sample(2, 10, 0)]
        let out = CursorSmoother(smoothingFactor: 0.5).smooth(input)
        assertPoint(out[0].point, 0, 0)     // first unchanged
        assertPoint(out[1].point, 5, 0)     // 0 + 0.5*(10-0)
        assertPoint(out[2].point, 7.5, 0)   // 5 + 0.5*(10-5)
    }

    func testFactorOneIsIdentity() {
        let input = [sample(0, 0, 0), sample(1, 10, 20), sample(2, 30, 5)]
        let out = CursorSmoother(smoothingFactor: 1.0).smooth(input)
        for (o, i) in zip(out, input) { assertPoint(o.point, Double(i.point.x), Double(i.point.y)) }
    }

    func testFactorZeroHoldsTheFirstPoint() {
        let input = [sample(0, 2, 2), sample(1, 10, 0), sample(2, 99, 99)]
        let out = CursorSmoother(smoothingFactor: 0.0).smooth(input)
        for o in out { assertPoint(o.point, 2, 2) }
    }

    // MARK: - invariants

    func testPreservesTimestampsAndCount() {
        let input = [sample(0.0, 0, 0), sample(0.5, 10, 0), sample(1.0, 20, 0)]
        let out = CursorSmoother(smoothingFactor: 0.3).smooth(input)
        XCTAssertEqual(out.count, input.count)
        XCTAssertEqual(out.map(\.time), input.map(\.time))
    }

    func testSmoothedPathStaysWithinInputBounds() {
        let input = [sample(0, 0, 0), sample(1, 100, 50), sample(2, 20, 90), sample(3, 60, 10)]
        let out = CursorSmoother(smoothingFactor: 0.4).smooth(input)
        let minX = input.map { Double($0.point.x) }.min()!
        let maxX = input.map { Double($0.point.x) }.max()!
        let minY = input.map { Double($0.point.y) }.min()!
        let maxY = input.map { Double($0.point.y) }.max()!
        for o in out {
            XCTAssertGreaterThanOrEqual(Double(o.point.x), minX - 1e-9)
            XCTAssertLessThanOrEqual(Double(o.point.x), maxX + 1e-9)
            XCTAssertGreaterThanOrEqual(Double(o.point.y), minY - 1e-9)
            XCTAssertLessThanOrEqual(Double(o.point.y), maxY + 1e-9)
        }
    }

    func testFactorIsClampedToUnitInterval() {
        let input = [sample(0, 0, 0), sample(1, 10, 0)]
        // > 1 behaves like 1 (identity)
        assertPoint(CursorSmoother(smoothingFactor: 5.0).smooth(input)[1].point, 10, 0)
        // < 0 behaves like 0 (holds first)
        assertPoint(CursorSmoother(smoothingFactor: -3.0).smooth(input)[1].point, 0, 0)
    }

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(CursorSmoother(smoothingFactor: 0.5))
        requireSendable(CursorSample(time: 0, point: .zero))
    }
}

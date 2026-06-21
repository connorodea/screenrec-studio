import XCTest
import CoreMedia
@testable import ScreenRecStudio

final class TrimRangeTests: XCTestCase {

    // MARK: - clamping to the asset

    func testClampsStartAndEndIntoAssetBounds() {
        let r = TrimRange(start: -5, end: 100, assetDuration: 60)
        XCTAssertEqual(r.start, 0, accuracy: 1e-9)
        XCTAssertEqual(r.end, 60, accuracy: 1e-9)
    }

    func testSwappedInOutIsNormalized() {
        let r = TrimRange(start: 40, end: 10, assetDuration: 60)
        XCTAssertEqual(r.start, 10, accuracy: 1e-9)
        XCTAssertEqual(r.end, 40, accuracy: 1e-9)
    }

    func testValidRangeIsPreserved() {
        let r = TrimRange(start: 5, end: 25, assetDuration: 60)
        XCTAssertEqual(r.start, 5, accuracy: 1e-9)
        XCTAssertEqual(r.end, 25, accuracy: 1e-9)
    }

    // MARK: - derived values

    func testFullCoversWholeAsset() {
        let r = TrimRange.full(60)
        XCTAssertEqual(r.start, 0, accuracy: 1e-9)
        XCTAssertEqual(r.end, 60, accuracy: 1e-9)
        XCTAssertEqual(r.duration, 60, accuracy: 1e-9)
    }

    func testDuration() {
        XCTAssertEqual(TrimRange(start: 5, end: 25, assetDuration: 60).duration, 20, accuracy: 1e-9)
    }

    func testIsEmptyWhenStartEqualsEnd() {
        XCTAssertTrue(TrimRange(start: 10, end: 10, assetDuration: 60).isEmpty)
        XCTAssertFalse(TrimRange(start: 10, end: 11, assetDuration: 60).isEmpty)
    }

    func testContains() {
        let r = TrimRange(start: 10, end: 40, assetDuration: 60)
        XCTAssertTrue(r.contains(10))
        XCTAssertTrue(r.contains(25))
        XCTAssertTrue(r.contains(40))
        XCTAssertFalse(r.contains(9.9))
        XCTAssertFalse(r.contains(40.1))
    }

    // MARK: - CMTimeRange conversion

    func testCMTimeRangeMatchesStartAndDuration() {
        let r = TrimRange(start: 5, end: 25, assetDuration: 60)
        let cm = r.cmTimeRange()
        XCTAssertEqual(CMTimeGetSeconds(cm.start), 5, accuracy: 1e-6)
        XCTAssertEqual(CMTimeGetSeconds(cm.duration), 20, accuracy: 1e-6)
    }

    // MARK: - Sendable

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(TrimRange.full(10))
    }
}

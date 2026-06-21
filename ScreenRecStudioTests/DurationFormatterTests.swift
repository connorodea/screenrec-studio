import XCTest
@testable import ScreenRecStudio

final class DurationFormatterTests: XCTestCase {

    func testUnderOneMinute() {
        XCTAssertEqual(DurationFormatter.clock(0), "0:00")
        XCTAssertEqual(DurationFormatter.clock(5), "0:05")
        XCTAssertEqual(DurationFormatter.clock(59), "0:59")
    }

    func testMinutesAndSeconds() {
        XCTAssertEqual(DurationFormatter.clock(65), "1:05")
        XCTAssertEqual(DurationFormatter.clock(605), "10:05")
        XCTAssertEqual(DurationFormatter.clock(3599), "59:59")
    }

    func testHoursRollOverInsteadOfShowingNinetyMinutes() {
        // The bug this replaces: the old formatter showed "90:00" at 1.5h.
        XCTAssertEqual(DurationFormatter.clock(3600), "1:00:00")
        XCTAssertEqual(DurationFormatter.clock(3661), "1:01:01")
        XCTAssertEqual(DurationFormatter.clock(5400), "1:30:00")
        XCTAssertEqual(DurationFormatter.clock(36000), "10:00:00")
    }

    func testNegativeClampsToZero() {
        XCTAssertEqual(DurationFormatter.clock(-5), "0:00")
    }

    func testFractionalSecondsFloor() {
        XCTAssertEqual(DurationFormatter.clock(5.9), "0:05")
        XCTAssertEqual(DurationFormatter.clock(3661.99), "1:01:01")
    }
}

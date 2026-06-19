import XCTest
import ScreenCaptureKit
import CoreMedia
import CoreVideo
import CoreGraphics
@testable import ScreenRecStudio

final class StreamConfigBuilderTests: XCTestCase {

    private func builder() -> StreamConfigBuilder {
        StreamConfigBuilder(
            pixelWidth: 2880, pixelHeight: 1800,
            frameRate: 60, showsCursor: true, queueDepth: 6
        )
    }

    // MARK: - pure derived values

    func testMinimumFrameIntervalIsReciprocalOfFrameRate() {
        let b = StreamConfigBuilder(
            pixelWidth: 100, pixelHeight: 100, frameRate: 60, showsCursor: true, queueDepth: 6
        )
        XCTAssertEqual(b.minimumFrameInterval, CMTime(value: 1, timescale: 60))
    }

    func testPixelFormatIsBGRA() {
        XCTAssertEqual(builder().pixelFormat, kCVPixelFormatType_32BGRA)
    }

    // MARK: - SCStreamConfiguration output

    func testConfigurationCarriesPixelDimensions() {
        let c = builder().makeConfiguration()
        XCTAssertEqual(c.width, 2880)
        XCTAssertEqual(c.height, 1800)
    }

    func testConfigurationSetsFrameIntervalCursorAndQueueDepth() {
        let c = builder().makeConfiguration()
        XCTAssertEqual(c.minimumFrameInterval, CMTime(value: 1, timescale: 60))
        XCTAssertTrue(c.showsCursor)
        XCTAssertEqual(c.queueDepth, 6)
    }

    func testConfigurationUsesBGRAPixelFormat() {
        XCTAssertEqual(builder().makeConfiguration().pixelFormat, kCVPixelFormatType_32BGRA)
    }

    func testConfigurationUsesSRGBColorSpace() {
        let c = builder().makeConfiguration()
        XCTAssertEqual(c.colorSpaceName as String?, CGColorSpace.sRGB as String?)
    }

    func testCursorFlagIsConfigurable() {
        let b = StreamConfigBuilder(
            pixelWidth: 100, pixelHeight: 100, frameRate: 30, showsCursor: false, queueDepth: 5
        )
        XCTAssertFalse(b.makeConfiguration().showsCursor)
    }
}

import XCTest
import AVFoundation
@testable import ScreenRecStudio

final class VideoSettingsTests: XCTestCase {

    // MARK: - outputSettings dictionary

    func testOutputSettingsUsesH264Codec() {
        let s = VideoSettings(width: 1920, height: 1080, frameRate: 60)
        XCTAssertEqual(s.outputSettings[AVVideoCodecKey] as? AVVideoCodecType, .h264)
    }

    func testOutputSettingsCarriesPixelDimensions() {
        let s = VideoSettings(width: 2880, height: 1800, frameRate: 60)
        XCTAssertEqual(s.outputSettings[AVVideoWidthKey] as? Int, 2880)
        XCTAssertEqual(s.outputSettings[AVVideoHeightKey] as? Int, 1800)
    }

    func testCompressionPropertiesIncludeBitrateProfileAndKeyframeInterval() {
        let s = VideoSettings(width: 1920, height: 1080, frameRate: 60, averageBitRate: 8_000_000)
        let props = s.outputSettings[AVVideoCompressionPropertiesKey] as? [String: Any]

        XCTAssertNotNil(props, "compression properties sub-dictionary must be present")
        XCTAssertEqual(props?[AVVideoAverageBitRateKey] as? Int, 8_000_000)
        XCTAssertEqual(props?[AVVideoProfileLevelKey] as? String, AVVideoProfileLevelH264HighAutoLevel)
        // ~1 keyframe per second at this frame rate.
        XCTAssertEqual(props?[AVVideoMaxKeyFrameIntervalKey] as? Int, 60)
    }

    // MARK: - estimatedBitRate

    func testEstimatedBitRateMatchesFormula() {
        // width * height * fps * 0.1 bits-per-pixel-per-frame
        let bps = VideoSettings.estimatedBitRate(width: 1920, height: 1080, frameRate: 60)
        XCTAssertEqual(bps, 12_441_600)
    }

    func testEstimatedBitRateScalesWithResolution() {
        let hd = VideoSettings.estimatedBitRate(width: 1920, height: 1080, frameRate: 60)
        let uhd = VideoSettings.estimatedBitRate(width: 3840, height: 2160, frameRate: 60)
        XCTAssertGreaterThan(uhd, hd)
    }

    func testEstimatedBitRateHasOneMegabitFloor() {
        let tiny = VideoSettings.estimatedBitRate(width: 64, height: 64, frameRate: 1)
        XCTAssertGreaterThanOrEqual(tiny, 1_000_000)
    }

    func testDefaultInitDerivesBitRateFromResolution() {
        let s = VideoSettings(width: 1920, height: 1080, frameRate: 60)
        XCTAssertEqual(
            s.averageBitRate,
            VideoSettings.estimatedBitRate(width: 1920, height: 1080, frameRate: 60)
        )
    }

    func testIsSendable() {
        // Compile-time assertion that VideoSettings is Sendable (carried across actors).
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(VideoSettings(width: 100, height: 100, frameRate: 30))
    }
}

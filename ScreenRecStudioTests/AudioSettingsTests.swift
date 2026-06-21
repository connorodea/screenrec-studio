import XCTest
import AVFoundation
@testable import ScreenRecStudio

final class AudioSettingsTests: XCTestCase {

    func testOutputSettingsUsesAAC() {
        let s = AudioSettings(sampleRate: 48_000, channels: 1, bitRate: 128_000)
        XCTAssertEqual(s.outputSettings[AVFormatIDKey] as? AudioFormatID, kAudioFormatMPEG4AAC)
    }

    func testOutputSettingsCarriesRateChannelsBitrate() {
        let s = AudioSettings(sampleRate: 48_000, channels: 2, bitRate: 160_000)
        XCTAssertEqual(s.outputSettings[AVSampleRateKey] as? Double, 48_000)
        XCTAssertEqual(s.outputSettings[AVNumberOfChannelsKey] as? Int, 2)
        XCTAssertEqual(s.outputSettings[AVEncoderBitRateKey] as? Int, 160_000)
    }

    func testDefaultsAreVoiceFriendlyMono48k() {
        let s = AudioSettings()
        XCTAssertEqual(s.sampleRate, 48_000)
        XCTAssertEqual(s.channels, 1)        // mono — a mic
        XCTAssertEqual(s.bitRate, 128_000)
    }

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(AudioSettings())
    }
}

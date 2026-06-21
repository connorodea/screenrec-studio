import XCTest
import AVFoundation
import CoreVideo
@testable import ScreenRecStudio

final class CameraSettingsTests: XCTestCase {

    func testQualityMapsToSessionPreset() {
        XCTAssertEqual(CameraSettings(quality: .hd720).sessionPreset, .hd1280x720)
        XCTAssertEqual(CameraSettings(quality: .hd1080).sessionPreset, .hd1920x1080)
        XCTAssertEqual(CameraSettings(quality: .vga).sessionPreset, .vga640x480)
    }

    func testPixelFormatIsBGRA() {
        XCTAssertEqual(CameraSettings(quality: .hd720).pixelFormat, kCVPixelFormatType_32BGRA)
    }

    func testVideoOutputSettingsCarriesPixelFormat() {
        let settings = CameraSettings(quality: .hd720).videoOutputSettings
        let key = kCVPixelBufferPixelFormatTypeKey as String
        XCTAssertEqual(settings[key] as? OSType, kCVPixelFormatType_32BGRA)
    }

    func testDefaultsToHD720() {
        XCTAssertEqual(CameraSettings().quality, .hd720)
    }

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(CameraSettings())
    }
}

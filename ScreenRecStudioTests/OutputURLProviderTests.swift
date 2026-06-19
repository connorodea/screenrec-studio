import XCTest
@testable import ScreenRecStudio

final class OutputURLProviderTests: XCTestCase {

    // MARK: - filename(for:timeZone:)

    func testFilenameFormatsTimestampWithMP4Extension() {
        let epoch = Date(timeIntervalSince1970: 0)
        let utc = TimeZone(identifier: "UTC")!

        let name = OutputURLProvider.filename(for: epoch, timeZone: utc)

        XCTAssertEqual(name, "1970-01-01_00-00-00.mp4")
    }

    func testFilenameZeroPadsSingleDigitComponents() {
        let utc = TimeZone(identifier: "UTC")!
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = utc
        // Every component single-digit so padding to two digits is actually exercised.
        let date = calendar.date(from: DateComponents(
            year: 2026, month: 3, day: 5, hour: 9, minute: 7, second: 4
        ))!

        let name = OutputURLProvider.filename(for: date, timeZone: utc)

        XCTAssertEqual(name, "2026-03-05_09-07-04.mp4")
    }

    // MARK: - makeURL(now:)

    func testMakeURLCreatesDirectoryAndReturnsTimestampedFile() throws {
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent("OutputURLProviderTests-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: tmp) }

        var provider = OutputURLProvider(directory: tmp)
        provider.timeZone = TimeZone(identifier: "UTC")!

        let url = try provider.makeURL(now: Date(timeIntervalSince1970: 0))

        XCTAssertTrue(
            FileManager.default.fileExists(atPath: tmp.path),
            "makeURL should create the output directory if it is missing"
        )
        XCTAssertEqual(url.lastPathComponent, "1970-01-01_00-00-00.mp4")
        XCTAssertEqual(url.pathExtension, "mp4")
        XCTAssertEqual(url.deletingLastPathComponent().standardizedFileURL, tmp.standardizedFileURL)
    }

    func testMakeURLIsIdempotentWhenDirectoryAlreadyExists() throws {
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent("OutputURLProviderTests-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: tmp) }
        try FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)

        let provider = OutputURLProvider(directory: tmp)

        XCTAssertNoThrow(try provider.makeURL(now: Date()))
        XCTAssertNoThrow(try provider.makeURL(now: Date()))
    }

    // MARK: - defaultDirectory

    func testDefaultDirectoryIsMoviesScreenRecStudio() {
        let dir = OutputURLProvider.defaultDirectory
        XCTAssertEqual(dir.lastPathComponent, "ScreenRecStudio")
        XCTAssertEqual(dir.deletingLastPathComponent().lastPathComponent, "Movies")
    }
}

import XCTest
@testable import ScreenRecStudio

final class UploadModelsTests: XCTestCase {

    private let decoder = JSONDecoder()

    // MARK: - UploadTicket (POST /api/uploads response)

    func testDecodesUploadTicket() throws {
        let json = """
        { "videoId": "vid-1", "slug": "ab12cd34efg",
          "watchUrl": "https://share.example.com/v/ab12cd34efg",
          "uploadURL": "https://upload.cloudflarestream.com/onetimetus",
          "uploadProtocol": "tus" }
        """.data(using: .utf8)!

        let t = try decoder.decode(UploadTicket.self, from: json)
        XCTAssertEqual(t.videoId, "vid-1")
        XCTAssertEqual(t.slug, "ab12cd34efg")
        XCTAssertEqual(t.watchUrl.absoluteString, "https://share.example.com/v/ab12cd34efg")
        XCTAssertEqual(t.uploadURL.absoluteString, "https://upload.cloudflarestream.com/onetimetus")
        XCTAssertEqual(t.uploadProtocol, "tus")
    }

    // MARK: - VideoStatus

    func testStatusRawValuesMatchContract() {
        XCTAssertEqual(VideoStatus.awaitingUpload.rawValue, "awaiting_upload")
        XCTAssertEqual(VideoStatus.processing.rawValue, "processing")
        XCTAssertEqual(VideoStatus.ready.rawValue, "ready")
        XCTAssertEqual(VideoStatus.failed.rawValue, "failed")
    }

    // MARK: - VideoMetadata (GET /api/videos/:id)

    func testDecodesReadyMetadataWithAIFields() throws {
        let json = """
        { "status": "ready", "slug": "ab12cd34efg",
          "watchUrl": "https://share.example.com/v/ab12cd34efg",
          "title": "My demo", "summary": "A short demo.",
          "chapters": [{"start": 12.5, "title": "Intro"}],
          "transcriptReady": true,
          "playback": {"hls": "https://customer-x.cloudflarestream.com/uid/manifest/video.m3u8",
                       "thumbnail": "https://customer-x.cloudflarestream.com/uid/thumbnails/thumbnail.jpg"} }
        """.data(using: .utf8)!

        let m = try decoder.decode(VideoMetadata.self, from: json)
        XCTAssertEqual(m.status, .ready)
        XCTAssertEqual(m.title, "My demo")
        XCTAssertEqual(m.summary, "A short demo.")
        XCTAssertEqual(m.chapters?.count, 1)
        XCTAssertEqual(m.chapters?.first?.start, 12.5)
        XCTAssertEqual(m.chapters?.first?.title, "Intro")
        XCTAssertTrue(m.transcriptReady)
        XCTAssertEqual(m.playback?.hls.absoluteString,
                       "https://customer-x.cloudflarestream.com/uid/manifest/video.m3u8")
        XCTAssertNotNil(m.playback?.thumbnail)
    }

    func testDecodesProcessingMetadataWithNulls() throws {
        let json = """
        { "status": "processing", "slug": "ab12cd34efg",
          "watchUrl": "https://share.example.com/v/ab12cd34efg",
          "title": null, "summary": null, "chapters": null,
          "transcriptReady": false, "playback": null }
        """.data(using: .utf8)!

        let m = try decoder.decode(VideoMetadata.self, from: json)
        XCTAssertEqual(m.status, .processing)
        XCTAssertNil(m.title)
        XCTAssertNil(m.chapters)
        XCTAssertNil(m.playback)
        XCTAssertFalse(m.transcriptReady)
    }

    func testMetadataRoundTrips() throws {
        let original = VideoMetadata(
            status: .ready, slug: "s", watchUrl: URL(string: "https://x/v/s")!,
            title: "t", summary: "u",
            chapters: [Chapter(start: 1, title: "c")],
            transcriptReady: true,
            playback: Playback(hls: URL(string: "https://x/h.m3u8")!, thumbnail: nil)
        )
        let data = try JSONEncoder().encode(original)
        let back = try decoder.decode(VideoMetadata.self, from: data)
        XCTAssertEqual(original, back)
    }

    func testTypesAreSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(VideoStatus.ready)
        requireSendable(Chapter(start: 0, title: "x"))
    }
}

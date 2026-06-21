import XCTest
@testable import ScreenRecStudio

final class UploadRequestBuilderTests: XCTestCase {

    private let builder = UploadRequestBuilder(
        baseURL: URL(string: "https://share.example.com")!,
        deviceToken: "tok-123"
    )

    // MARK: - ticket request (POST /api/uploads)

    func testTicketRequestMethodURLAndAuth() {
        let req = builder.ticketRequest(filename: "rec.mp4", durationSeconds: 12.5, sizeBytes: 1000)
        XCTAssertEqual(req.httpMethod, "POST")
        XCTAssertEqual(req.url?.path, "/api/uploads")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer tok-123")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func testTicketRequestBodyEncodesTheContract() throws {
        let req = builder.ticketRequest(filename: "rec.mp4", durationSeconds: 12.5, sizeBytes: 1000)
        let body = try XCTUnwrap(req.httpBody)
        let decoded = try JSONDecoder().decode(UploadTicketRequest.self, from: body)
        XCTAssertEqual(decoded, UploadTicketRequest(filename: "rec.mp4", durationSeconds: 12.5, sizeBytes: 1000))
    }

    // MARK: - metadata poll (GET /api/videos/:id)

    func testMetadataRequest() {
        let req = builder.metadataRequest(videoId: "vid-9")
        XCTAssertEqual(req.httpMethod, "GET")
        XCTAssertEqual(req.url?.path, "/api/videos/vid-9")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer tok-123")
    }

    // MARK: - tus upload

    private let uploadURL = URL(string: "https://upload.cloudflarestream.com/onetime")!

    func testTusHeadRequestForResumeOffset() {
        let req = builder.tusHeadRequest(uploadURL: uploadURL)
        XCTAssertEqual(req.httpMethod, "HEAD")
        XCTAssertEqual(req.url, uploadURL)
        XCTAssertEqual(req.value(forHTTPHeaderField: "Tus-Resumable"), "1.0.0")
    }

    func testTusPatchRequestCarriesOffsetAndChunk() {
        let chunk = Data([0x01, 0x02, 0x03, 0x04])
        let req = builder.tusPatchRequest(uploadURL: uploadURL, offset: 2048, chunk: chunk)
        XCTAssertEqual(req.httpMethod, "PATCH")
        XCTAssertEqual(req.url, uploadURL)
        XCTAssertEqual(req.value(forHTTPHeaderField: "Tus-Resumable"), "1.0.0")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Upload-Offset"), "2048")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Content-Type"), "application/offset+octet-stream")
        XCTAssertEqual(req.httpBody, chunk)
    }

    // MARK: - Sendable

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(builder)
    }
}

import Foundation

/// Body of `POST /api/uploads`.
struct UploadTicketRequest: Codable, Equatable, Sendable {
    let filename: String
    let durationSeconds: Double
    let sizeBytes: Int
}

/// Builds the `URLRequest`s for the share-loop upload flow (see
/// `docs/share-loop-spec.md`): request an upload ticket from our backend, poll
/// metadata, and PATCH bytes to Cloudflare Stream over tus. Pure construction so
/// every request's method/URL/headers/body is unit-testable without a network.
struct UploadRequestBuilder: Sendable {
    var baseURL: URL
    var deviceToken: String

    static let tusVersion = "1.0.0"

    /// `POST /api/uploads` — asks the backend for an upload ticket.
    func ticketRequest(filename: String, durationSeconds: Double, sizeBytes: Int) -> URLRequest {
        var request = URLRequest(url: apiURL("uploads"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(
            UploadTicketRequest(filename: filename, durationSeconds: durationSeconds, sizeBytes: sizeBytes)
        )
        return request
    }

    /// `GET /api/videos/:id` — polled after upload for status + AI fields.
    func metadataRequest(videoId: String) -> URLRequest {
        var request = URLRequest(url: apiURL("videos", videoId))
        request.httpMethod = "GET"
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        return request
    }

    /// tus `HEAD` — reads the current `Upload-Offset` to resume.
    func tusHeadRequest(uploadURL: URL) -> URLRequest {
        var request = URLRequest(url: uploadURL)
        request.httpMethod = "HEAD"
        request.setValue(Self.tusVersion, forHTTPHeaderField: "Tus-Resumable")
        return request
    }

    /// tus `PATCH` — uploads one chunk at `offset`.
    func tusPatchRequest(uploadURL: URL, offset: Int, chunk: Data) -> URLRequest {
        var request = URLRequest(url: uploadURL)
        request.httpMethod = "PATCH"
        request.setValue(Self.tusVersion, forHTTPHeaderField: "Tus-Resumable")
        request.setValue(String(offset), forHTTPHeaderField: "Upload-Offset")
        request.setValue("application/offset+octet-stream", forHTTPHeaderField: "Content-Type")
        request.httpBody = chunk
        return request
    }

    private func apiURL(_ components: String...) -> URL {
        components.reduce(baseURL.appendingPathComponent("api")) { $0.appendingPathComponent($1) }
    }
}

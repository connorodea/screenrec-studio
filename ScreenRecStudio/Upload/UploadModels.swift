import Foundation

/// The processing lifecycle of an uploaded recording (mirrors the backend
/// `videos.status`). See `docs/share-loop-spec.md`.
enum VideoStatus: String, Codable, Sendable {
    case awaitingUpload = "awaiting_upload"
    case processing
    case ready
    case failed
}

/// Response to `POST /api/uploads`: where to send the bytes and where the video
/// will live.
struct UploadTicket: Codable, Equatable, Sendable {
    let videoId: String
    let slug: String
    let watchUrl: URL
    let uploadURL: URL
    let uploadProtocol: String
}

/// An AI-generated chapter marker.
struct Chapter: Codable, Equatable, Sendable {
    let start: TimeInterval
    let title: String
}

/// Playback sources for the watch page / preview.
struct Playback: Codable, Equatable, Sendable {
    let hls: URL
    let thumbnail: URL?
}

/// Response to `GET /api/videos/:id` — the client polls this after upload to learn
/// when the link is live and to surface the AI title/summary/chapters.
struct VideoMetadata: Codable, Equatable, Sendable {
    let status: VideoStatus
    let slug: String
    let watchUrl: URL
    let title: String?
    let summary: String?
    let chapters: [Chapter]?
    let transcriptReady: Bool
    let playback: Playback?
}

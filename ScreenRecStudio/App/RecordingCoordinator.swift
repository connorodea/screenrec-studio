import SwiftUI
import AppKit
import Combine

/// The single source of truth for the capture UI. Drives the `RecordingState`
/// machine and orchestrates the `CaptureEngine` (off-main) and `ScreenRecorder`
/// (off-main) actors. All state mutation happens here, on the main actor.
///
/// Uses `ObservableObject` (not the `@Observable` macro) because the deployment
/// floor is macOS 13.0; the Observation framework is macOS 14.0+.
@MainActor
final class RecordingCoordinator: ObservableObject {
    @Published private(set) var state: RecordingState = .idle
    /// When the current recording started — the view derives the elapsed timer.
    @Published private(set) var startedAt: Date?

    private let engine = CaptureEngine()
    private let recorder = ScreenRecorder()
    private var videoTask: Task<Void, Never>?
    private var audioTask: Task<Void, Never>?

    private let frameRate = 60
    private let showsCursor = true
    private let captureMic = true

    // MARK: - Intents

    func start() {
        guard state.canTransition(to: .requestingPermission) else { return }
        transition(to: .requestingPermission)
        Task { await beginCapture() }
    }

    func stop() {
        guard state == .recording else { return }
        transition(to: .finishing)
        Task { await finishCapture() }
    }

    func reset() {
        guard state.canTransition(to: .idle) else { return }
        startedAt = nil
        transition(to: .idle)
    }

    func openScreenRecordingSettings() {
        NSWorkspace.shared.open(Permissions.settingsURL)
    }

    func revealInFinder(_ url: URL) {
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    // MARK: - Pipeline

    private func beginCapture() async {
        do {
            let streams = try await engine.start(
                frameRate: frameRate, showsCursor: showsCursor, captureMic: captureMic
            )
            transition(to: .ready)

            let url = try OutputURLProvider().makeURL(now: Date())
            let videoSettings = VideoSettings(
                width: streams.size.width, height: streams.size.height, frameRate: frameRate
            )
            let audioSettings: AudioSettings? = streams.audio != nil ? AudioSettings() : nil
            try await recorder.begin(url: url, videoSettings: videoSettings, audioSettings: audioSettings)

            // Ordered consume loops — FIFO into the recorder actor.
            videoTask = Task { [recorder] in
                for await box in streams.video {
                    await recorder.ingest(box)
                }
            }
            if let audio = streams.audio {
                audioTask = Task { [recorder] in
                    for await box in audio {
                        await recorder.ingestAudio(box)
                    }
                }
            }

            startedAt = Date()
            transition(to: .recording)
        } catch {
            await recorder.abort()
            transition(to: .error(Self.message(for: error)))
        }
    }

    private func finishCapture() async {
        do {
            try await engine.stop()      // stop both sources + close the frame streams
            await videoTask?.value       // drain buffered frames into the recorder
            await audioTask?.value
            videoTask = nil
            audioTask = nil
            let url = try await recorder.finish()
            startedAt = nil
            transition(to: .done(url))
        } catch {
            videoTask?.cancel()
            audioTask?.cancel()
            videoTask = nil
            audioTask = nil
            startedAt = nil
            transition(to: .error(Self.message(for: error)))
        }
    }

    // MARK: - Helpers

    private func transition(to next: RecordingState) {
        guard state.canTransition(to: next) else {
            assertionFailure("Illegal transition \(state) -> \(next)")
            return
        }
        state = next
    }

    /// Maps a thrown error to a user-facing message, distinguishing the common
    /// permission-denied case via the live TCC check.
    static func message(for error: Error) -> String {
        if !Permissions.hasScreenRecordingAccess {
            return CaptureError.permissionDenied.errorDescription ?? "Permission required."
        }
        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            return description
        }
        return error.localizedDescription
    }
}

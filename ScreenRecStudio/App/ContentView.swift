import SwiftUI

/// Renders the current `RecordingState`. Holds no capture logic — it only
/// dispatches intents (`start` / `stop` / `reset`) to the coordinator.
struct ContentView: View {
    @EnvironmentObject private var coordinator: RecordingCoordinator

    var body: some View {
        VStack(spacing: 20) {
            header
            Spacer(minLength: 0)
            content
            Spacer(minLength: 0)
        }
        .frame(width: 460, height: 340)
        .padding(28)
    }

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "record.circle.fill").foregroundStyle(.red)
            Text("ScreenRec Studio").font(.headline)
            Spacer()
            Text("Phase 0").font(.caption).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder private var content: some View {
        switch coordinator.state {
        case .idle, .ready:
            idleView
        case .requestingPermission:
            progress("Requesting Screen Recording permission…")
        case .recording:
            recordingView
        case .finishing:
            progress("Finishing…")
        case .done(let url):
            doneView(url)
        case .error(let message):
            errorView(message)
        }
    }

    private func progress(_ label: String) -> some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(label).foregroundStyle(.secondary)
        }
    }

    private var idleView: some View {
        VStack(spacing: 16) {
            Image(systemName: "rectangle.dashed.badge.record")
                .font(.system(size: 50)).foregroundStyle(.secondary)
            Text("Record your main display").font(.title3)
            Text("Captures at native resolution to ~/Movies/ScreenRecStudio.")
                .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button { coordinator.start() } label: {
                Label("Start Recording", systemImage: "record.circle").frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonStyle(.borderedProminent).tint(.red)
        }
    }

    private var recordingView: some View {
        VStack(spacing: 16) {
            TimelineView(.periodic(from: Date(), by: 1)) { _ in
                Text(elapsedString)
                    .font(.system(size: 44, weight: .semibold, design: .monospaced))
            }
            HStack(spacing: 6) {
                Circle().fill(.red).frame(width: 10, height: 10)
                Text("Recording").foregroundStyle(.secondary)
            }
            Button { coordinator.stop() } label: {
                Label("Stop", systemImage: "stop.fill").frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonStyle(.borderedProminent).tint(.red)
        }
    }

    private func doneView(_ url: URL) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48)).foregroundStyle(.green)
            Text("Saved").font(.title3)
            Text(url.lastPathComponent)
                .font(.callout.monospaced()).foregroundStyle(.secondary)
                .lineLimit(1).truncationMode(.middle)
            HStack(spacing: 12) {
                Button("Reveal in Finder") { coordinator.revealInFinder(url) }
                Button("Record Again") { coordinator.reset() }.buttonStyle(.borderedProminent)
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 44)).foregroundStyle(.yellow)
            Text(message)
                .font(.callout).multilineTextAlignment(.center).foregroundStyle(.secondary)
            HStack(spacing: 12) {
                if !Permissions.hasScreenRecordingAccess {
                    Button("Open Privacy Settings") { coordinator.openScreenRecordingSettings() }
                }
                Button("Try Again") { coordinator.reset() }.buttonStyle(.borderedProminent)
            }
        }
    }

    private var elapsedString: String {
        let seconds = Int(Date().timeIntervalSince(coordinator.startedAt ?? Date()))
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

import SwiftUI

/// Application entry point.
///
/// Phase 0 is a single-window capture spike. The `RecordingCoordinator` is owned
/// here via `@State` and injected into the environment so the whole view tree
/// reads one source of truth (the `@State`-owned `AppState` pattern from Clarc).
@main
struct ScreenRecStudioApp: App {
    @StateObject private var coordinator = RecordingCoordinator()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(coordinator)
        }
        .defaultSize(width: 460, height: 340)
        .windowResizability(.contentSize)
    }
}

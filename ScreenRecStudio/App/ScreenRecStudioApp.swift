import SwiftUI

/// Application entry point.
///
/// Phase 0 is a single-window capture spike. This entry is intentionally minimal
/// until Tier 4, when `RecordingCoordinator` and the real `ContentView` exist and
/// get wired in here (mirroring the `@State`-owned `AppState` pattern in Clarc).
@main
struct ScreenRecStudioApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .defaultSize(width: 460, height: 340)
        .windowResizability(.contentSize)
    }
}

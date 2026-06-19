import SwiftUI

/// Placeholder shell — replaced at Tier 4 with a state-driven view that renders
/// each `RecordingState` (Start / recording timer / Stop / Finishing / Saved / error).
struct ContentView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "record.circle")
                .font(.system(size: 44))
                .foregroundStyle(.red)
            Text("ScreenRec Studio")
                .font(.title2.weight(.semibold))
            Text("Phase 0 — capture spike")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }
}

#Preview {
    ContentView()
}

import Foundation

/// The capture lifecycle as a small, explicit state machine.
///
/// `RecordingCoordinator` is the only thing that mutates it, and it consults
/// `canTransition(to:)` so an out-of-order transition (e.g. recording → done
/// without finalizing the file) is a logic error we can catch rather than a
/// silent corrupt recording.
enum RecordingState: Equatable, Sendable {
    case idle
    case requestingPermission
    case ready
    case recording
    case finishing
    case done(URL)
    case error(String)

    /// Whether moving from `self` to `next` is a legal step in the lifecycle.
    /// Associated values are ignored for the purpose of the transition table.
    func canTransition(to next: RecordingState) -> Bool {
        switch (self, next) {
        case (.idle, .requestingPermission),
             (.requestingPermission, .ready),
             (.requestingPermission, .error),
             (.ready, .recording),
             (.ready, .error),
             (.recording, .finishing),
             (.recording, .error),
             (.finishing, .done),
             (.finishing, .error),
             (.done, .idle),
             (.error, .idle):
            return true
        default:
            return false
        }
    }
}

import XCTest
@testable import ScreenRecStudio

final class RecordingStateTests: XCTestCase {

    private let url = URL(fileURLWithPath: "/tmp/a.mp4")

    // MARK: - Equatable (associated values matter)

    func testEquatableComparesAssociatedValues() {
        XCTAssertEqual(RecordingState.done(url), .done(url))
        XCTAssertNotEqual(RecordingState.done(url), .done(URL(fileURLWithPath: "/tmp/b.mp4")))
        XCTAssertEqual(RecordingState.error("boom"), .error("boom"))
        XCTAssertNotEqual(RecordingState.error("boom"), .error("other"))
        XCTAssertNotEqual(RecordingState.idle, .ready)
    }

    // MARK: - Legal transitions

    func testLegalTransitions() {
        XCTAssertTrue(RecordingState.idle.canTransition(to: .requestingPermission))
        XCTAssertTrue(RecordingState.requestingPermission.canTransition(to: .ready))
        XCTAssertTrue(RecordingState.requestingPermission.canTransition(to: .error("denied")))
        XCTAssertTrue(RecordingState.ready.canTransition(to: .recording))
        XCTAssertTrue(RecordingState.ready.canTransition(to: .error("setup")))
        XCTAssertTrue(RecordingState.recording.canTransition(to: .finishing))
        XCTAssertTrue(RecordingState.recording.canTransition(to: .error("io")))
        XCTAssertTrue(RecordingState.finishing.canTransition(to: .done(url)))
        XCTAssertTrue(RecordingState.finishing.canTransition(to: .error("disk")))
        XCTAssertTrue(RecordingState.done(url).canTransition(to: .idle))
        XCTAssertTrue(RecordingState.error("x").canTransition(to: .idle))
    }

    // MARK: - Illegal transitions

    func testIllegalTransitions() {
        // Can't record without going through permission first.
        XCTAssertFalse(RecordingState.idle.canTransition(to: .recording))
        // Recording must be finalized via `finishing`, never jump straight to done.
        XCTAssertFalse(RecordingState.recording.canTransition(to: .done(url)))
        // No self-loops.
        XCTAssertFalse(RecordingState.idle.canTransition(to: .idle))
        XCTAssertFalse(RecordingState.recording.canTransition(to: .recording))
        // Terminal-ish states can only reset to idle.
        XCTAssertFalse(RecordingState.done(url).canTransition(to: .recording))
        // `ready` goes to recording, not directly to finishing.
        XCTAssertFalse(RecordingState.ready.canTransition(to: .finishing))
    }

    // MARK: - Sendable

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(RecordingState.recording)
    }
}

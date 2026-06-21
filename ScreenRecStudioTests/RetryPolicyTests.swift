import XCTest
@testable import ScreenRecStudio

final class RetryPolicyTests: XCTestCase {

    private let policy = RetryPolicy(maxAttempts: 5, baseDelay: 0.5, multiplier: 2.0, maxDelay: 30)

    func testDelayGrowsExponentially() {
        XCTAssertEqual(policy.delay(forAttempt: 1), 0.5, accuracy: 1e-9)  // base
        XCTAssertEqual(policy.delay(forAttempt: 2), 1.0, accuracy: 1e-9)  // base * 2
        XCTAssertEqual(policy.delay(forAttempt: 3), 2.0, accuracy: 1e-9)  // base * 4
        XCTAssertEqual(policy.delay(forAttempt: 4), 4.0, accuracy: 1e-9)  // base * 8
    }

    func testDelayIsCappedAtMaxDelay() {
        XCTAssertEqual(policy.delay(forAttempt: 100), 30, accuracy: 1e-9)
    }

    func testNonPositiveAttemptHasNoDelay() {
        XCTAssertEqual(policy.delay(forAttempt: 0), 0, accuracy: 1e-9)
        XCTAssertEqual(policy.delay(forAttempt: -3), 0, accuracy: 1e-9)
    }

    func testShouldRetryUntilMaxAttempts() {
        XCTAssertTrue(policy.shouldRetry(afterAttempt: 1))
        XCTAssertTrue(policy.shouldRetry(afterAttempt: 4))
        XCTAssertFalse(policy.shouldRetry(afterAttempt: 5))
        XCTAssertFalse(policy.shouldRetry(afterAttempt: 6))
    }

    func testDefaultsAreReasonable() {
        let d = RetryPolicy()
        XCTAssertGreaterThanOrEqual(d.maxAttempts, 3)
        XCTAssertGreaterThan(d.baseDelay, 0)
        XCTAssertGreaterThan(d.multiplier, 1)
        XCTAssertGreaterThan(d.maxDelay, d.baseDelay)
    }

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(RetryPolicy())
    }
}

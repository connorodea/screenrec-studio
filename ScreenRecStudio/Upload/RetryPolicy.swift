import Foundation

/// Exponential-backoff policy for resumable uploads and metadata polling.
/// Deterministic (no jitter) so the schedule is unit-testable; the caller sleeps
/// `delay(forAttempt:)` between tries and stops when `shouldRetry` is false.
struct RetryPolicy: Sendable {
    var maxAttempts: Int
    var baseDelay: TimeInterval
    var multiplier: Double
    var maxDelay: TimeInterval

    init(maxAttempts: Int = 5, baseDelay: TimeInterval = 0.5, multiplier: Double = 2.0, maxDelay: TimeInterval = 30) {
        self.maxAttempts = maxAttempts
        self.baseDelay = baseDelay
        self.multiplier = multiplier
        self.maxDelay = maxDelay
    }

    /// Delay before retry `attempt` (1-based: attempt 1 is the first retry).
    /// `base * multiplier^(attempt-1)`, capped at `maxDelay`; 0 for attempt <= 0.
    func delay(forAttempt attempt: Int) -> TimeInterval {
        guard attempt >= 1 else { return 0 }
        let raw = baseDelay * pow(multiplier, Double(attempt - 1))
        return min(raw, maxDelay)
    }

    /// Whether another attempt is allowed after `attempt` tries.
    func shouldRetry(afterAttempt attempt: Int) -> Bool {
        attempt < maxAttempts
    }
}

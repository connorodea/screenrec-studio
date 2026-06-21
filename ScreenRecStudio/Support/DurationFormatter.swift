import Foundation

/// Formats an elapsed duration as a clock string. Shows `m:ss` under an hour and
/// `h:mm:ss` from one hour up — so a long recording reads `1:30:00`, not `90:00`.
enum DurationFormatter {
    static func clock(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds))   // floor + clamp negatives
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }
}

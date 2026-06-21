import Foundation

/// Keyboard modifier flags for a global hotkey.
struct KeyModifiers: OptionSet, Codable, Sendable {
    let rawValue: Int

    static let command = KeyModifiers(rawValue: 1 << 0)
    static let option  = KeyModifiers(rawValue: 1 << 1)
    static let control = KeyModifiers(rawValue: 1 << 2)
    static let shift   = KeyModifiers(rawValue: 1 << 3)
}

/// A global hotkey (e.g. start/stop recording), persistable and displayable.
/// `displayString` renders modifiers in Apple HIG order (⌃⌥⇧⌘) regardless of how
/// the set was constructed.
struct KeyCombo: Codable, Equatable, Sendable {
    var modifiers: KeyModifiers
    var key: String

    /// Default record/stop hotkey: ⌃⌥⌘R.
    static let defaultRecord = KeyCombo(modifiers: [.control, .option, .command], key: "R")

    var displayString: String {
        var result = ""
        if modifiers.contains(.control) { result += "⌃" }
        if modifiers.contains(.option)  { result += "⌥" }
        if modifiers.contains(.shift)   { result += "⇧" }
        if modifiers.contains(.command) { result += "⌘" }
        result += key.uppercased()
        return result
    }
}

import XCTest
@testable import ScreenRecStudio

final class KeyComboTests: XCTestCase {

    // MARK: - display string (Apple HIG modifier order: ⌃⌥⇧⌘)

    func testDisplayUsesHIGModifierOrderRegardlessOfConstruction() {
        let combo = KeyCombo(modifiers: [.command, .control, .option], key: "R")
        XCTAssertEqual(combo.displayString, "⌃⌥⌘R")
    }

    func testFullModifierSet() {
        let combo = KeyCombo(modifiers: [.control, .option, .shift, .command], key: "R")
        XCTAssertEqual(combo.displayString, "⌃⌥⇧⌘R")
    }

    func testSingleModifier() {
        XCTAssertEqual(KeyCombo(modifiers: [.command], key: "R").displayString, "⌘R")
    }

    func testKeyIsUppercasedInDisplay() {
        XCTAssertEqual(KeyCombo(modifiers: [.command], key: "r").displayString, "⌘R")
    }

    // MARK: - default

    func testDefaultRecordHotkey() {
        XCTAssertEqual(KeyCombo.defaultRecord.displayString, "⌃⌥⌘R")
        XCTAssertTrue(KeyCombo.defaultRecord.modifiers.contains(.command))
    }

    // MARK: - persistence + equality

    func testCodableRoundTrip() throws {
        let combo = KeyCombo(modifiers: [.control, .shift], key: "S")
        let data = try JSONEncoder().encode(combo)
        let back = try JSONDecoder().decode(KeyCombo.self, from: data)
        XCTAssertEqual(combo, back)
    }

    func testEquatable() {
        XCTAssertEqual(KeyCombo(modifiers: [.command], key: "R"),
                       KeyCombo(modifiers: [.command], key: "R"))
        XCTAssertNotEqual(KeyCombo(modifiers: [.command], key: "R"),
                          KeyCombo(modifiers: [.command], key: "S"))
    }

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(KeyCombo.defaultRecord)
    }
}

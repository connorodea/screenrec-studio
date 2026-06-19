import Foundation

/// Produces the on-disk destination for a recording: a timestamped `.mp4` inside
/// a base directory (default `~/Movies/ScreenRecStudio`), creating the directory
/// if it does not yet exist.
///
/// Pure and injectable (directory / `FileManager` / `TimeZone`) so the filename
/// formatting and directory-creation behavior are unit-testable without touching
/// the user's real Movies folder.
struct OutputURLProvider {
    var directory: URL
    var fileManager: FileManager
    var timeZone: TimeZone

    init(
        directory: URL = OutputURLProvider.defaultDirectory,
        fileManager: FileManager = .default,
        timeZone: TimeZone = .current
    ) {
        self.directory = directory
        self.fileManager = fileManager
        self.timeZone = timeZone
    }

    /// `~/Movies/ScreenRecStudio`.
    static var defaultDirectory: URL {
        let movies = FileManager.default
            .urls(for: .moviesDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Movies", isDirectory: true)
        return movies.appendingPathComponent("ScreenRecStudio", isDirectory: true)
    }

    /// Creates the output directory if needed and returns a fresh timestamped file URL.
    func makeURL(now: Date) throws -> URL {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(Self.filename(for: now, timeZone: timeZone))
    }

    /// `yyyy-MM-dd_HH-mm-ss.mp4`, zero-padded, in the given time zone. Built from
    /// `Calendar` components (not a localized `DateFormatter`) so the result is
    /// deterministic and locale-independent.
    static func filename(for date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second], from: date
        )
        return String(
            format: "%04d-%02d-%02d_%02d-%02d-%02d.mp4",
            c.year ?? 0, c.month ?? 0, c.day ?? 0,
            c.hour ?? 0, c.minute ?? 0, c.second ?? 0
        )
    }
}

import Foundation

/// Splits a file of `totalSize` bytes into `chunkSize` byte ranges for the tus
/// upload loop. Pure logic — the uploader asks for `nextChunk(at:)` given the
/// server-reported offset (from a tus HEAD) and PATCHes that range, repeating
/// until `isComplete`. Resumable: a dropped connection just re-reads the offset.
struct ChunkPlan: Sendable {
    var totalSize: Int
    var chunkSize: Int

    /// `chunkSize` clamped to at least 1 so a bad value can't divide-by-zero or hang.
    private var step: Int { max(1, chunkSize) }

    /// The byte range to upload starting at `offset`, or nil if nothing remains.
    func nextChunk(at offset: Int) -> Range<Int>? {
        guard offset >= 0, offset < totalSize else { return nil }
        return offset ..< min(offset + step, totalSize)
    }

    func isComplete(at offset: Int) -> Bool { offset >= totalSize }

    var chunkCount: Int {
        guard totalSize > 0 else { return 0 }
        return (totalSize + step - 1) / step
    }

    /// All chunk ranges in order — convenient for tests and bounded retries.
    func allChunks() -> [Range<Int>] {
        var ranges: [Range<Int>] = []
        var offset = 0
        while let range = nextChunk(at: offset) {
            ranges.append(range)
            offset = range.upperBound
        }
        return ranges
    }
}

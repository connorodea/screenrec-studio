import XCTest
@testable import ScreenRecStudio

final class ChunkPlanTests: XCTestCase {

    func testEmptyUploadHasNoChunksAndIsComplete() {
        let plan = ChunkPlan(totalSize: 0, chunkSize: 4)
        XCTAssertNil(plan.nextChunk(at: 0))
        XCTAssertEqual(plan.chunkCount, 0)
        XCTAssertTrue(plan.isComplete(at: 0))
        XCTAssertTrue(plan.allChunks().isEmpty)
    }

    func testExactMultipleSplitsEvenly() {
        let plan = ChunkPlan(totalSize: 8, chunkSize: 4)
        XCTAssertEqual(plan.allChunks(), [0..<4, 4..<8])
        XCTAssertEqual(plan.chunkCount, 2)
    }

    func testRemainderProducesShortFinalChunk() {
        let plan = ChunkPlan(totalSize: 10, chunkSize: 4)
        XCTAssertEqual(plan.allChunks(), [0..<4, 4..<8, 8..<10])
        XCTAssertEqual(plan.chunkCount, 3)
    }

    func testChunkLargerThanTotalIsOneChunk() {
        let plan = ChunkPlan(totalSize: 3, chunkSize: 10)
        XCTAssertEqual(plan.allChunks(), [0..<3])
        XCTAssertEqual(plan.chunkCount, 1)
    }

    func testNextChunkAtAndBeyondEndIsNil() {
        let plan = ChunkPlan(totalSize: 10, chunkSize: 4)
        XCTAssertEqual(plan.nextChunk(at: 8), 8..<10)
        XCTAssertNil(plan.nextChunk(at: 10))
        XCTAssertNil(plan.nextChunk(at: 99))
    }

    func testIsComplete() {
        let plan = ChunkPlan(totalSize: 10, chunkSize: 4)
        XCTAssertFalse(plan.isComplete(at: 0))
        XCTAssertFalse(plan.isComplete(at: 9))
        XCTAssertTrue(plan.isComplete(at: 10))
        XCTAssertTrue(plan.isComplete(at: 11))
    }

    func testZeroChunkSizeDoesNotCrashOrHang() {
        // Defensive: a 0 chunk size is clamped to 1 rather than dividing by zero.
        let plan = ChunkPlan(totalSize: 3, chunkSize: 0)
        XCTAssertEqual(plan.chunkCount, 3)
        XCTAssertEqual(plan.allChunks(), [0..<1, 1..<2, 2..<3])
    }

    func testIsSendable() {
        func requireSendable<T: Sendable>(_ value: T) {}
        requireSendable(ChunkPlan(totalSize: 1, chunkSize: 1))
    }
}

import AVFoundation

/// Owns the `AVAssetWriter` and serializes every writer mutation. All writer
/// access happens inside this actor, so no two threads ever touch it.
///
/// Frames arrive as `SampleBox` values (sole-ownership transfer of a non-Sendable
/// `CMSampleBuffer`) via `ingest(_:)`, in FIFO order from the capture pipeline.
actor ScreenRecorder {
    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private var outputURL: URL?
    private var started = false
    private var lastPresentationTime: CMTime = .zero
    private var frameCount = 0

    /// Prepares the writer for `url` with the given H.264 settings. Does not start
    /// the session — that happens on the first ingested frame, anchored to its PTS.
    func begin(url: URL, videoSettings: VideoSettings) throws {
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings.outputSettings)
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else { throw RecorderError.cannotAddInput }
        writer.add(input)

        self.writer = writer
        self.input = input
        self.outputURL = url
        self.started = false
        self.lastPresentationTime = .zero
        self.frameCount = 0
    }

    /// Appends one complete frame. Starts the session on the first frame (anchored
    /// to its presentation timestamp), then drops frames when the input isn't ready
    /// (real-time back-pressure) rather than blocking the capture pipeline.
    func ingest(_ box: SampleBox) {
        guard let writer, let input else { return }
        let sampleBuffer = box.buffer
        guard CMSampleBufferDataIsReady(sampleBuffer) else { return }

        let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)

        if !started {
            guard writer.startWriting() else { return }   // status == .failed
            writer.startSession(atSourceTime: pts)
            started = true
        }

        guard writer.status == .writing, input.isReadyForMoreMediaData else { return }

        if input.append(sampleBuffer) {
            lastPresentationTime = pts
            frameCount += 1
        }
    }

    /// Finalizes the file. Caller MUST have stopped the capture stream first so no
    /// frames arrive during finalization (stopCapture → finish).
    func finish() async throws -> URL {
        guard let writer, let input, let url = outputURL else {
            throw RecorderError.notRecording
        }

        // Nothing usable was captured — delete the empty file and report.
        guard started, frameCount > 0 else {
            cleanup(deleting: url)
            throw RecorderError.noFramesCaptured
        }

        input.markAsFinished()
        writer.endSession(atSourceTime: lastPresentationTime)
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            writer.finishWriting { continuation.resume() }
        }

        let status = writer.status
        let failure = writer.error?.localizedDescription
        cleanup(deleting: nil)

        guard status == .completed else {
            throw RecorderError.finishFailed(failure ?? "unknown error")
        }
        return url
    }

    /// Best-effort teardown for error paths; removes any partial file.
    func abort() {
        let url = outputURL
        cleanup(deleting: url)
    }

    private func cleanup(deleting url: URL?) {
        if let url { try? FileManager.default.removeItem(at: url) }
        writer = nil
        input = nil
        outputURL = nil
        started = false
        lastPresentationTime = .zero
        frameCount = 0
    }
}

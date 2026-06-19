import AVFoundation

/// Describes the H.264 video encoding for a recording and produces the
/// `AVAssetWriterInput` `outputSettings` dictionary.
///
/// Pure value type (`Sendable`) so it can be built on the main actor and handed
/// to the `ScreenRecorder` actor, and so the settings dictionary is unit-testable
/// without instantiating a writer.
struct VideoSettings: Sendable {
    var width: Int
    var height: Int
    var frameRate: Int
    var averageBitRate: Int

    init(width: Int, height: Int, frameRate: Int, averageBitRate: Int? = nil) {
        self.width = width
        self.height = height
        self.frameRate = frameRate
        self.averageBitRate = averageBitRate
            ?? Self.estimatedBitRate(width: width, height: height, frameRate: frameRate)
    }

    /// Bits per pixel per frame used to size the average bitrate. Screen content
    /// is compressible, but 0.1 leaves headroom for high-motion captures.
    static let bitsPerPixelPerFrame = 0.1

    /// Never go below 1 Mbps even for tiny capture regions.
    static let minimumBitRate = 1_000_000

    static func estimatedBitRate(width: Int, height: Int, frameRate: Int) -> Int {
        let raw = Double(width * height * frameRate) * bitsPerPixelPerFrame
        return max(minimumBitRate, Int(raw))
    }

    /// The dictionary passed to `AVAssetWriterInput(mediaType: .video, outputSettings:)`.
    var outputSettings: [String: Any] {
        [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: averageBitRate,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                AVVideoMaxKeyFrameIntervalKey: frameRate,   // ~1 keyframe / second
                AVVideoAllowFrameReorderingKey: true,
            ] as [String: Any],
        ]
    }
}

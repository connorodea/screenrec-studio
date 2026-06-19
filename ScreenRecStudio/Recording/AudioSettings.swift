import AVFoundation

/// Describes the AAC audio encoding for a recording and produces the
/// `AVAssetWriterInput` `outputSettings` dictionary for the audio track.
///
/// Defaults to mono 48 kHz / 128 kbps — voice-friendly for narration. Pure value
/// type (`Sendable`) so it can be built on the main actor and handed to the
/// `ScreenRecorder` actor, and so the settings dictionary is unit-testable.
struct AudioSettings: Sendable {
    var sampleRate: Double
    var channels: Int
    var bitRate: Int

    init(sampleRate: Double = 48_000, channels: Int = 1, bitRate: Int = 128_000) {
        self.sampleRate = sampleRate
        self.channels = channels
        self.bitRate = bitRate
    }

    /// The dictionary passed to `AVAssetWriterInput(mediaType: .audio, outputSettings:)`.
    /// The writer transcodes the incoming mic samples to AAC at these parameters.
    var outputSettings: [String: Any] {
        [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: channels,
            AVEncoderBitRateKey: bitRate,
        ]
    }
}

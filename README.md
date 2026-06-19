# ScreenRec Studio

A native-macOS screen recorder + video editor (a ScreenFlow-class tool), built
phase by phase. See `docs/` / the build spec for the full roadmap.

> **Status: Phase 0 — capture spike.** The app builds, requests Screen Recording
> permission, captures the **main display** via ScreenCaptureKit, and writes an
> **H.264 `.mp4` (video only)** to `~/Movies/ScreenRecStudio/`. Audio, webcam, the
> editor timeline, and export are later phases.

## Requirements

- macOS 13.0+ (deployment floor; developed/tested on macOS 26, Apple Silicon)
- Xcode 16+ installed (the build is driven by `xcodebuild`)
- [XcodeGen](https://github.com/yonidavidson/XcodeGen) (`brew install xcodegen`)

The committed source of truth for the project is **`project.yml`**; the
`.xcodeproj` is generated from it and is gitignored.

## Build & test

If full Xcode is installed but Command Line Tools is the active toolchain, you do
**not** need `sudo xcode-select --switch` — point `xcodebuild` at Xcode per-command:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

xcodegen generate                               # regenerate ScreenRecStudio.xcodeproj
xcodebuild build  -project ScreenRecStudio.xcodeproj -scheme ScreenRecStudio -destination 'platform=macOS'
xcodebuild test   -project ScreenRecStudio.xcodeproj -scheme ScreenRecStudio -destination 'platform=macOS'
```

(Or, permanently: `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`, then drop the `DEVELOPER_DIR` prefix.)

The unit tests cover the four **pure seams** — the logic that can be checked
without a display or TCC permission:

| Seam | What it does |
|------|--------------|
| `OutputURLProvider` | timestamped `~/Movies/ScreenRecStudio/<ts>.mp4` + directory creation |
| `VideoSettings` | AVAssetWriter H.264 `outputSettings` + bitrate estimation |
| `StreamConfigBuilder` | macOS 13.0-safe `SCStreamConfiguration` (BGRA, 60 fps, cursor) |
| `RecordingState` | capture lifecycle state machine + transition table |

The live ScreenCaptureKit → AVAssetWriter path is **not** headless-testable (it
needs a real display + granted permission), so it is verified by the manual
checklist below.

## Run it (manual capture verification)

ScreenCaptureKit attributes its permission to the **app bundle**, so launch the
built `.app`, not a bare binary. Easiest is from Xcode:

```sh
open ScreenRecStudio.xcodeproj   # then press Cmd+R
```

Or run the built product directly:

```sh
open "$(xcodebuild -project ScreenRecStudio.xcodeproj -scheme ScreenRecStudio -showBuildSettings 2>/dev/null \
  | awk '/ BUILT_PRODUCTS_DIR /{d=$3} END{print d}')/ScreenRecStudio.app"
```

Then walk the checklist:

1. **Start Recording** → the macOS **Screen Recording** permission prompt appears
   (or the app shows the permission-error state with an *Open Privacy Settings*
   button). Grant it under **System Settings ▸ Privacy & Security ▸ Screen
   Recording**, relaunch if asked.
2. After granting, **Start** → the UI shows **Recording** with a running timer and
   a red indicator.
3. Move windows / play a video for ~10 seconds so the frames aren't blank.
4. **Stop** → the UI goes **Finishing → Saved**.
5. **Reveal in Finder** → confirm `~/Movies/ScreenRecStudio/<timestamp>.mp4` exists
   and is non-zero.
6. Inspect the file (QuickTime or `ffprobe`): codec **h264**, resolution equals the
   main display's **pixel** size (e.g. 3456×2234 on a 16″ Retina, not the point
   size), duration ≈ recording length, cursor visible, **no** audio track.
7. Record again → a new timestamped file, no overwrite.
8. Error smoke test: revoke permission in Settings → **Start** → app shows the
   error state with the settings button, no crash.

## Architecture (Phase 0)

```
SCShareableContent ─pick main display→ SCContentFilter ┐
StreamConfigBuilder → SCStreamConfiguration (pixels,60fps,BGRA,cursor) ┤
                                                       ▼
        SCStream ─addStreamOutput(.screen)→ StreamOutputAdapter
                                                       │ (keep only .complete frames)
                                                       ▼ AsyncStream<SampleBox> (ordered, bounded)
                                                  ScreenRecorder (actor)
                                            AVAssetWriter + input.append(sampleBuffer)
                                                       ▼
                                   ~/Movies/ScreenRecStudio/<timestamp>.mp4
```

Concurrency model (Swift 6, `strict-concurrency = complete`):

- `RecordingCoordinator` — `@MainActor`, `ObservableObject`. The only mutator of
  `RecordingState`; orchestrates the two actors. (`ObservableObject` rather than
  the `@Observable` macro because that macro is macOS 14+, and the floor is 13.0.)
- `CaptureEngine` / `ScreenRecorder` — `actor`s; own the `SCStream` and
  `AVAssetWriter` respectively, off the main actor.
- `StreamOutputAdapter` — `nonisolated` SCK delegate on a serial queue.
- Non-`Sendable` `CMSampleBuffer` / `SCShareableContent` cross actor boundaries via
  single-ownership `@unchecked Sendable` transfer boxes (`SampleBox`,
  `ShareableContentBox`); sample buffers travel through an ordered, bounded
  `AsyncStream` so they stay in FIFO order.

## Layout

```
project.yml                      XcodeGen spec (committed; .xcodeproj generated)
ScreenRecStudio/
  App/        ScreenRecStudioApp, ContentView, RecordingCoordinator, RecordingState
  Capture/    CaptureEngine, StreamOutputAdapter, Permissions, ShareableContent,
              StreamConfigBuilder, CaptureError
  Recording/  ScreenRecorder, OutputURLProvider, VideoSettings
  Support/    Info.plist, ScreenRecStudio.entitlements
ScreenRecStudioTests/            unit tests for the four pure seams
```

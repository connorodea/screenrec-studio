# ScreenRec Studio — Progress Snapshot (2026-06-19)

## TL;DR
- **Product direction:** pivoted from a ScreenFlow-class local editor → a **native
  "Loom"** (hybrid: native capture + light edit + instant AI-enriched shareable link).
  See `docs/roadmap.md` (competitive map) and `docs/share-loop-spec.md` (API contract).
- **Runnable today:** the app records **screen + microphone → MP4**. Phase 0 verified on
  hardware (h264, 3456×2234, native Retina); A1 audio lip-sync pending your check.
- **Built + fully tested ahead of integration:** auto-zoom, cursor smoothing, trim,
  webcam/PiP geometry, the entire A3 upload client, the hotkey model.
- **110 tests, zero failures, clean Swift 6 build.** 13 feature branches off `main`;
  PR #1 (Phase 0) open. Nothing merged yet.

## What the app actually DOES today (wired + runnable)
- **Phase 0** — ScreenCaptureKit main-display capture → H.264 MP4 (`~/Movies/ScreenRecStudio`).
- **A1** — + microphone, muxed as an AAC track (host-clock A/V sync; degrades to video-only).
- **UI** — SwiftUI window: Start/Stop, recording timer (h:mm:ss), Reveal in Finder,
  permission-error state with a Settings deep link.

## Built + fully tested, NOT yet wired into the runnable app
The logic exists and is unit-covered; each needs an integration/visual or backend sprint
(noted) to become user-visible.

| Module | Does | Tests | Becomes visible via |
|---|---|---|---|
| `AutoZoomPlanner` + `CursorSmoother` | A6 auto-zoom plan + buttery pan | 10 + 9 | cursor capture + GPU zoom render |
| `TrimRange` | A5 in/out → CMTimeRange | 9 | trim UI + export |
| `PiPLayout` + `CameraSettings` + `WebcamCapture` | A2 webcam bubble geometry + camera source | 10 + 5 | real-time compositing |
| `UploadModels` + `RetryPolicy` + `UploadRequestBuilder` + `ChunkPlan` | A3 upload client (contract models, backoff, tus requests, chunking) | 6+6+6+8 | URLSession glue + backend (B1) |
| `KeyCombo` | A4 global hotkey model | 8 | hotkey registration + menubar |

## Test coverage (110, by file)
AutoZoomPlanner 10 · PiPLayout 10 · CursorSmoother 9 · TrimRange 9 · ChunkPlan 8 ·
KeyCombo 8 · VideoSettings 8 · StreamConfigBuilder 7 · RetryPolicy 6 · UploadModels 6 ·
UploadRequestBuilder 6 · AudioSettings 4→ (now 4) · CameraSettings 5 · DurationFormatter 5 ·
OutputURLProvider 5 · RecordingState 4.

## Branch stack (linear, off `main`)
```
main (root: scaffold + 4 TDD seams)
 └ phase-0-capture-spike   ← PR #1 open
   └ a1-mic-capture
     └ a2-webcam
       └ a6-autozoom
         └ a5-trim
           └ cursor-smoothing
             └ duration-formatter
               └ a3-client-models
                 └ a3-tus-builder
                   └ a3-chunk-plan
                     └ a4-keycombo   ← current tip
docs/native-loom-roadmap · docs/share-loop-spec · docs/progress
```
The stack is deep because each sprint is its own feature branch (per the no-direct-to-main
rule) and nothing is merged. Merging PR #1, then fast-forwarding the chain, collapses it.

## Gated on you (priority order)
1. **Monorepo `web/` vs separate repo** (spec decision #1) → unblocks the *entire backend*
   (B1–B3): slug gen, zod validation, status state machine, webhook verification — a large
   body of testable TS I won't scaffold unilaterally.
2. **Provisioning go-ahead** — Cloudflare Stream + webhook, Postgres on hetznerCO, deploy
   target → unblocks the live share loop (the "are-we-Loom-yet" milestone).
3. **Remaining spec decisions** — brand/domain, link visibility + retention policy, MVP auth.
4. **A1 lip-sync check** — record + talk, confirm audio is in sync.
5. **Merge PR #1** and decide how to land the branch stack.

## Build / run
```
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodegen generate
xcodebuild build -project ScreenRecStudio.xcodeproj -scheme ScreenRecStudio -destination 'platform=macOS'
xcodebuild test  -project ScreenRecStudio.xcodeproj -scheme ScreenRecStudio -destination 'platform=macOS'
open ScreenRecStudio.xcodeproj   # Cmd+R to run the app
```

## Conventions in force
Swift 6 strict concurrency · TDD the pure seams (red→green, manual-verify the live path) ·
actors for capture/encode, `@MainActor ObservableObject` coordinator (macOS 13 floor) ·
XcodeGen project · commits authored as the `connorodea` noreply · one feature branch per change.

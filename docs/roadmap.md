# ScreenRec Studio → "Native Loom" — Product Roadmap

> **Positioning.** A macOS-native screen recorder whose output becomes an
> **instant, AI-enriched, cloud-hosted shareable link** — the Loom workflow, but
> with native-capture quality, light editing, and a stack you own. We are *not*
> building ScreenFlow (heavy local editor) and *not* cloning Loom feature-for-feature.
> The wedge is the **hybrid**: "a Loom you can actually edit," or "a ScreenFlow that
> shares like Loom." Loom is too thin to edit; ScreenFlow/Camtasia are too heavy to
> share fast. We sit in the gap.

## Why this is attemptable (and the honest caution)

Loom exited to Atlassian for ~$975M — the category is proven and large, which means
both real demand **and** a deep-pocketed incumbent with distribution. We do **not**
win head-on. We win because:

- **Capture is already better.** Native ScreenCaptureKit (Phase 0, verified: 3456×2234
  H.264 at native quality) beats Loom's browser/Electron capture. That fight is over.
- **We own the expensive part.** A Loom clone normally dies on cloud video infra +
  AI cost/complexity. We assemble it from services already in hand:
  **Cloudflare Stream + R2** (upload, transcode→HLS, global CDN, player, signed
  playback, built-in analytics), **Deepgram** (transcript; Cutroom already does ASR),
  **Anthropic** (titles/summaries/chapters/filler-word markers).
- **Per-video cost is cents** at MVP scale (Stream storage+delivery ≈ $1/1000 min each;
  Deepgram ≈ $0.0043/min; Claude per-video tiny).

**The real risk is distribution, not tech.** Loom grew via the share-link network
effect + Atlassian reach. We need a niche wedge (course creators / coaches — the Skool
crowd; or indie devs; or privacy-sensitive teams) and a beautiful, fast **watch page**
as the growth surface. Don't out-feature Loom; out-position it for one audience.

## Competitive landscape (and the open lane)

| Product | Capture | Share loop | AI / transcript / analytics | Editing | Pricing |
|---|---|---|---|---|---|
| **Loom** (Atlassian) | web/Electron, mediocre | ✅ core, viral links | ✅ transcript, AI, viewer analytics | ✗ thin | subscription, lock-in |
| **CleanShot X** | ✅ native, excellent (webcam, mic/sys audio, click highlights) | ✅ CleanShot Cloud, instant link, custom domains | ✗ **none** | annotation only | one-time license + optional Cloud sub |
| **Screen Studio** | ✅ native, gorgeous; **automatic zoom-to-cursor + smooth motion** | ✗ export-first, no hosted links | ✗ none | render/export editor | one-time/sub |
| **ScreenFlow / Camtasia** | ✅ native | ✗ | ✗ | ✅ heavy multi-track | perpetual $$ |
| **Tella** | web, creator-focused | ✅ links | partial | layouts/backgrounds | subscription |

**The open lane:** the best native-capture tools (CleanShot, Screen Studio) have **no AI
or analytics layer**; the AI/analytics leader (Loom) has **weak capture and thin
editing**. Nobody pairs *native-quality capture* with an *AI-native, analytics-rich,
own-your-stack share loop* — and nobody but Screen Studio does **automatic zoom**, which
Loom and CleanShot both lack.

**Our differentiated bundle:** native capture (CleanShot/Screen Studio class) +
**automatic cursor zoom** (Screen Studio's killer feature, AI/heuristic-driven — and it
fits "light edit," not a heavy timeline) + **instant AI link** (transcript, summary,
chapters, searchable, viewer analytics — beyond Loom) + own-stack / fair pricing.
CleanShot's commercial success validates "native + cloud link + fair price"; we add the
brain it deliberately omits.

## Decisions locked (2026-06-19)

- **Direction:** hybrid Loom share-loop (record → instant link → AI), light trim only.
- **Backend + watch page:** Next.js on **hetznerCO** + Postgres, Cloudflare CDN in
  front, existing Hetzner CI/CD. Video delivered globally by Cloudflare Stream's edge.
- **Video infra:** Cloudflare Stream (primary); R2 for original retention if needed.
- **AI:** Deepgram (transcript) + Anthropic (title/summary/chapters/filler markers).
- **Auth:** anonymous viewer links (no viewer signup → viral) + lightweight creator auth.
- **Upload:** direct-to-Stream (tus / one-time upload URL) so video bytes skip our server.
- **Brand/domain:** keep the `screenrec-studio` repo for now; pick a punchy brand +
  short domain **before Phase B2** (when links become public — the link is the billboard).

## Architecture — two tracks meeting at an upload API

```
macOS app (Swift)                          cloud backend (Next.js @ hetznerCO)
─────────────────                          ──────────────────────────────────
record screen+mic(+cam) → local MP4
   │  authed request: "give me an upload URL"
   ├───────────────────────────────────▶  POST /api/uploads  → CF Stream direct-upload URL
   │  direct upload bytes (tus)                                  │ store {id, owner?, streamUID,
   ├──────────────▶  Cloudflare Stream  ◀──────────────────────┘ status} in Postgres
   │  notify "uploaded" (streamUID)                              │
   └───────────────────────────────────▶  POST /api/uploads/:id/complete
                                              │ enqueue AI job:
                                              │   audio → Deepgram transcript
                                              │   transcript → Claude title/summary/chapters
                                              ▼
   viewer ──▶ GET /v/<id>  (watch page) ── CF Stream HLS player (signed) + title +
                                            interactive transcript + summary + CTA
                                              │ view/watch-% events → analytics
```

Concurrency / quality conventions from Phase 0 carry forward (Swift 6 strict
concurrency, actors for capture/encode, `@MainActor` coordinator, TDD the pure seams).

## Phased roadmap

**Track A — macOS capture client** (extends the verified Phase 0):

| Phase | Deliverable | Notes |
|------|-------------|-------|
| **A1** | mic capture → screen+mic MP4, Start/Stop | shared prerequisite; introduces A/V sync (named risk) |
| **A2** | webcam capture + **PiP "bubble"** + optional system audio; separate tracks | Loom's signature cam bubble |
| **A3** | stop → **direct upload to Cloudflare Stream**, progress, retry, "copy link" | half of the "are-we-Loom-yet" moment |
| **A4** | menubar-first UX + global hotkey + 3-2-1 countdown | Loom lives in the menubar, not a window |
| **A5** | light trim (in/out points) before upload | *no* multi-track timeline |
| **A6** | **automatic cursor zoom** + smooth cursor motion (heuristic/AI-driven) | Screen Studio's killer feature; Loom & CleanShot lack it; counts as "light edit" |

**Track B — cloud backend (the differentiation):**

| Phase | Deliverable | Notes |
|------|-------------|-------|
| **B1** | upload service: mint Stream upload URLs, metadata in Postgres | |
| **B2** | **watch page** `/v/<id>` — Stream HLS player | brand/domain decided here |
| **B3** | **AI layer**: Deepgram transcript + Claude title/summary/chapters + interactive transcript | core differentiator |
| **B4** | creator auth + video library (manage/copy/delete) | |
| **B5** | viewer analytics (views, watch-%, per-viewer) | Stream analytics + our events |
| **B6** | share controls (unlisted/password/expiry), CTA, embed | |
| **B7** | Stripe billing, onboarding, GTM wedge, ship | |

**🎯 "Are-we-Loom-yet" milestone = A3 + B1 + B2** — record → upload → instant playable
link. Everything before is capture plumbing; everything after is differentiation.

## Build sequencing

1. **A1 → A2** first: capture is the shared foundation and is needed on every path.
2. Then the **vertical slice A3 + B1 + B2** to stand up the end-to-end share loop with a
   throwaway-simple watch page — prove "record on Mac, watch on a link" before polishing.
3. **B3 (AI)** next — it's the headline differentiator and cheap to add.
4. **B4/B5** (accounts, analytics), then **A4/A5** (UX polish, trim), then **B6/B7**.

Each phase ends with something runnable and gets its own spec → plan → build cycle.
The backend (Track B) is an independent sub-project from the macOS app (Track A); they
are versioned together but developed against the stable upload API contract.

## Immediate next step

**Phase A1 — mic capture.** Add `AVCaptureSession` mic input, mux an AAC audio track
into the existing `AVAssetWriter` pipeline alongside the screen video, and handle the
A/V start-session timing so audio and video share a timeline. TDD the pure seams (audio
settings dict, mux timing math); verify the muxed MP4 plays with sound via the manual
checklist. This advances the existing "Phase 1 — Recorder MVP" task.

## Open items (not blocking A1)

- **Brand + short domain** — decide before B2.
- **GTM niche** — pick the one audience the watch page is designed for (creators/coaches,
  indie devs, or privacy-first teams) before B7; informs B2/B3 framing.
- **Cost guardrails** — per-account storage/delivery caps before public launch.
- **Privacy/ToS** — anonymous links + hosted recordings need a clear retention + delete policy.

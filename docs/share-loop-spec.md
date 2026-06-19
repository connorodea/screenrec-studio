# Share-Loop Spec — the "are-we-Loom-yet" vertical slice (A3 + B1 + B2 + B3)

> Goal: **record on the Mac → one-click → an instant, AI-enriched, hosted watch
> link.** This spec defines the API contract and data flow so the macOS client
> (Track A) and the Next.js backend (Track B) can be built against a fixed
> interface. Execution-ready: when authorized, build in the phase order at the end.

Status: **design only.** No cloud resources are provisioned and nothing is deployed
by this document. See "Decisions needed from you" before implementation.

## Data flow

```
macOS app                         Next.js @ hetznerCO              Cloudflare Stream
─────────                         ──────────────────              ─────────────────
finish recording (mp4)
  │ POST /api/uploads ───────────▶ create Stream direct-upload  ─▶ returns tus URL + uid
  │   {filename,dur,size}          insert videos row (awaiting)
  │ ◀─ {videoId,slug,watchUrl,uploadURL}
  │ tus-upload bytes ───────────────────────────────────────────▶ (bytes skip our server)
  │ poll GET /api/videos/:id        Stream encodes…
  │                                 ◀── webhook: video ready ───── POST /api/webhooks/stream
  │                                 status=ready; enqueue AI job
  │                                   ├ Deepgram transcript
  │                                   └ Claude title/summary/chapters
  │ ◀─ {status:ready, title, summary, playback}
  └ copy watchUrl  ──────▶ viewer opens GET /v/:slug (HLS player + transcript + summary)
```

## API contract (the fixed interface)

All JSON. Creator calls authenticated with a device bearer token (see Auth). Viewer
endpoints are unauthenticated.

### `POST /api/uploads`  (creator)
Request: `{ "filename": string, "durationSeconds": number, "sizeBytes": number }`
Action: request a Cloudflare Stream **direct creator upload** (tus) → `{uploadURL, uid}`;
insert a `videos` row (`status=awaiting_upload`, `stream_uid=uid`, fresh `slug`).
Response `201`:
```json
{ "videoId": "uuid", "slug": "ab12cd34efg",
  "watchUrl": "https://<host>/v/ab12cd34efg",
  "uploadURL": "https://upload.cloudflarestream.com/<one-time-tus>",
  "uploadProtocol": "tus" }
```

### Client → `uploadURL`  (tus, resumable)
The app uploads the MP4 bytes directly to Cloudflare via tus. Bytes never transit our
server. Resumable so a dropped connection retries from the last chunk.

### `POST /api/webhooks/stream`  (Cloudflare → us)
Cloudflare Stream posts when a video's `status.state` becomes `ready`. **Verify the
`Webhook-Signature` HMAC** against the configured secret. On `ready`: set
`status=ready`, persist `duration_s`, `thumbnail_url`, then enqueue the AI job. (This
is the authoritative "ready" signal — not the client.)

### `GET /api/videos/:videoId`  (creator polls)
Response:
```json
{ "status": "awaiting_upload|processing|ready|failed",
  "slug": "ab12cd34efg", "watchUrl": "...",
  "title": "string|null", "summary": "string|null",
  "chapters": [{ "start": 12.5, "title": "Intro" }],
  "transcriptReady": true,
  "playback": { "hls": "https://customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8",
                "thumbnail": "https://.../thumbnails/thumbnail.jpg" } }
```

### `GET /v/:slug`  (viewer, SSR HTML)
The watch page: Cloudflare Stream HLS player (Stream `<stream>` embed or hls.js),
title, AI summary, **interactive transcript** (click a line → seek), owner label, and
a copy-link affordance. Emits view + watch-% events to `/api/events` (B5, later).

## Data model — `videos` (Postgres @ hetznerCO)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `slug` | text unique | short, URL-safe; the `/v/<slug>` id |
| `stream_uid` | text | Cloudflare Stream video UID |
| `status` | text | `awaiting_upload \| processing \| ready \| failed` |
| `title` / `summary` | text null | AI-generated, creator-editable |
| `chapters` / `transcript` | jsonb null | |
| `duration_s` | double precision null | from Stream |
| `thumbnail_url` | text null | |
| `owner_id` | uuid null | null = anonymous (MVP) |
| `created_at` / `ready_at` | timestamptz | |

State machine: `awaiting_upload → processing → ready` (or `→ failed` from either). Pure,
testable.

## AI pipeline (B3) — fired on the `ready` webhook

1. Obtain audio for `stream_uid` (Cloudflare Stream download/clip, or re-use the local
   original if still held).
2. **Deepgram Nova-3** → transcript (words + paragraphs + utterances). Persist `transcript`.
3. **Claude** over the transcript → `{ title, summary, chapters[] }` (strict JSON schema,
   prompt-cached system prompt). Persist. Set `title/summary/chapters`.
4. Mark transcript/AI ready; the creator's poll surfaces it; the watch page renders it.

Reuse the existing **Deepgram** skill and **Anthropic** key; Cutroom already does ASR and
can lend patterns.

## Cloudflare Stream specifics

- **Direct creator upload (tus):** `POST /accounts/{acct}/stream?direct_user=true` with
  `Tus-Resumable`, `Upload-Length`, `Upload-Metadata` → `Location` (one-time URL) +
  `stream-media-id`. Use tus (not the simple `direct_upload`) because recordings can
  exceed the 200 MB simple-upload cap.
- **Webhook:** configure a Stream webhook; verify `Webhook-Signature` (HMAC-SHA256).
- **Playback (MVP, unlisted):** public HLS manifest or the Stream embed. Switch to
  **signed URLs** when private/password sharing lands (B6).

## Auth

- **Creator:** a device bearer token minted on first app launch (or a simple sign-in
  later). For MVP it can be a single shared app token; harden in B4.
- **Viewer:** none — anonymous links are the growth surface. Add unlisted/password/expiry
  in B6.

## Secrets / env (names only — never inline values)

- `CLOUDFLARE_CO_ACCOUNT_ID`, `CLOUDFLARE_CO_API_TOKEN` (in `~/.zshrc`) — token needs
  **Stream:Edit**.
- Stream **webhook signing secret** (new).
- Deepgram API key (via the `deepgram` skill / `DEEPGRAM_API_KEY`).
- `ANTHROPIC_API_KEY`.
- Postgres connection URL (hetznerCO).
- App **device-token signing secret** (new).

## Testable units (so TDD applies on build)

**Backend (TS, vitest):**
- `generateSlug()` — length, URL-safe alphabet, collision-retry.
- request validation (zod schemas for each endpoint).
- `status` state-machine transitions (mirror of the Swift `RecordingState` discipline).
- webhook signature verification (HMAC).
- watch-page view-model assembly (transcript jsonb → rendered segments).
- Claude-output → chapters parsing/validation.

**Client (Swift, XCTest — same TDD style as the 76 existing tests):**
- `UploadTicket` / `VideoMetadata` Codable round-trips.
- upload-request builder (URL, method, headers, body).
- `RetryPolicy` (exponential backoff + cap + jitter).
- post-upload polling state machine.

## Repo structure

Recommend **monorepo**: add `web/` (Next.js 14 app + API routes + Postgres access)
alongside the Swift app, so the shared API contract lives in one place and changes ship
together. Deploy `web/` to hetznerCO via the existing CI/CD pattern (owner-based secrets,
rsync + restart). *(Decision — see below.)*

## Build order (within the slice)

1. **B1a** — `POST /api/uploads` returns a real Stream tus URL + inserts the row.
   *(tests: slug, validation)*
2. **A3** — Swift client: request ticket → tus-upload the MP4 → poll → copy link.
   *(tests: models, request builder, retry)*
3. **B1b** — Stream webhook → `status=ready`. *(tests: signature, state machine)*
4. **B2** — `/v/:slug` watch page with the Stream player. **← "are-we-Loom-yet" reached.**
5. **B3** — AI pipeline (Deepgram + Claude) on ready. *(tests: transcript/summary assembly)*

## Decisions needed from you (before build)

1. **Monorepo `web/`** vs a separate `screenrec-web` repo.
2. **Brand + short domain** for `/v/<slug>` (the link is the billboard).
3. **Link visibility default** — fully public vs unlisted-by-default — and the
   recording **retention + delete** policy (hosted user video needs a clear stance).
4. **MVP auth** — anonymous links only, or a lightweight creator device token now.
5. **Provisioning go-ahead** — create the Cloudflare Stream config + webhook, the
   Postgres DB on hetznerCO, and the deploy target. (All outward-facing — needs your OK.)

## Cost (MVP scale)

Cloudflare Stream ≈ $5 / 1000 min stored + $1 / 1000 min delivered; Deepgram ≈
$0.0043/min; Claude pennies per video. **Cents per recording** — feasible to run.

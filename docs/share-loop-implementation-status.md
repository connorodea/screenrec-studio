# Share-Loop Backend — Implementation Status & Wiring Handoff

Status as of this branch. The **pure + hardening logic of the share-loop backend is
feature-complete and fully unit-tested** (139 web tests across 24 files, `tsc --noEmit`
clean). What remains is **provisioning-bound**: the Postgres data layer, the thin Next.js
route files, the AI-job worker, and deploy. This doc is the runbook for finishing it.

> The macOS capture app (Swift) is a separate track and is not covered here. Its tests
> (~110) run via Xcode and are not executable in the headless dev environment.

---

## 1. What's built (all in `web/src/lib/`, each with a `*.test.ts`)

**Domain / state**
- `videoStatus.ts` — server-authoritative state machine: `awaiting_upload → processing → ready`, plus `failed`. `transition()` throws on illegal moves; `isTerminal()`.
- `watchViewModel.ts` — `VideoRow` (the stored row shape), `buildWatchViewModel()`, `normalizeSegments()`/normalizeChapters (trim/clamp/sort), `DEFAULT_TITLE`.
- `validation.ts` — `parseUploadRequest()` (the `POST /api/uploads` body).
- `slug.ts` — `makeSlug()` (the public watch slug).

**Request builders (pure)**
- `streamUpload.ts` — `buildStreamDirectUploadRequest()` (Cloudflare tus direct-creator-upload).
- `deepgramRequest.ts` — `buildDeepgramRequest()` (Deepgram listen, Token auth + JSON body).
- `summaryPrompt.ts` — `buildSummaryRequest()` (Anthropic Messages, model `claude-opus-4-7`, cached system prefix, `[seconds]` markers), `formatTranscript()`.

**Response parsers (pure)**
- `deepgram.ts` — `deepgramToSegments()` / `deepgramPlainTranscript()`.
- `aiSummary.ts` — `parseAiSummary()` (validates `{title, summary, chapters}`, unwraps fenced/prose JSON).
- `webhook.ts` — `verifyWebhook()` / `computeSignature()` (Cloudflare Stream webhook signature).

**Orchestration handlers (dependency-injected — the real endpoint logic)**
- `createUpload.ts` — `createUpload(deps, body)` → validate → slug → Stream upload → insert row → tus ticket. 400 invalid / 502 Stream failure.
- `handleUploadComplete.ts` — `handleUploadComplete(deps, {videoId})` → owns `awaiting_upload → processing` (client calls it when its tus upload finishes). Idempotent.
- `handleStreamWebhook.ts` — `handleStreamWebhook(deps, {header, body})` → verify → on `ready` for a non-terminal video, `markReady` + `enqueueAiJob`. Idempotent acks; 401 bad sig.
- `handleVideoRead.ts` — `handleWatch(deps, slug)` (watch view-model / 404) + `handleVideoMetadata(deps, id)` (raw poll fields / 404).
- `aiPipeline.ts` — `runAiPipeline(deps, {videoId, audioUrl})` → transcribe → summarize → persist → complete. No-speech / unparseable / transcription-failure paths.

**Live network clients (injected `fetch` / SDK `create` — testable without creds)**
- `streamClient.ts` — `createDirectUpload(config, params)` → the real `createStreamUpload`.
- `deepgramClient.ts` — `runDeepgramRequest(fetch, req)` → the real `callDeepgram`.
- `claudeClient.ts` — `runClaudeRequest(create, req)` → the real `callClaude`.

**Infra / cross-cutting**
- `config.ts` — `loadConfig(env)`: validates required env, fails fast listing every missing var.
- `streamUrls.ts` — `cloudflareStreamUrls(subdomain, uid)` → `{hls, dash, thumbnail, mp4Download}`.
- `videoPersistence.ts` — `coerceStoredSegments()` / `coerceStoredChapters()` (defensive read-side JSON coercion).
- `withRetry.ts` — `withRetry(op, opts)` (exponential backoff, injected `sleep`).
- `httpError.ts` — `HttpClientError` (carries `status`) + `isTransientHttpError()` (429/5xx/network → retry).

**End-to-end**: `shareLoop.integration.test.ts` drives all handlers through one in-memory store, proving they compose.

---

## 2. The `videos` table (Postgres on hetznerCO)

```sql
CREATE TABLE videos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text UNIQUE NOT NULL,
  stream_uid       text UNIQUE NOT NULL,
  status           text NOT NULL DEFAULT 'awaiting_upload',  -- awaiting_upload|processing|ready|failed
  ai_status        text NOT NULL DEFAULT 'pending',          -- pending|complete|failed
  title            text,
  summary          text,
  transcript       jsonb,        -- TranscriptSegment[]; read via coerceStoredSegments()
  chapters         jsonb,        -- ChapterMarker[];     read via coerceStoredChapters()
  stream_hls       text,         -- set at markReady from cloudflareStreamUrls().hls
  thumbnail        text,
  duration_seconds double precision,
  ai_error         text,         -- markFailed reason
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX videos_stream_uid_idx ON videos (stream_uid);
```

`status` (Stream lifecycle) and `ai_status` (AI enrichment) are **separate axes**: `ready` is
terminal, and the AI job runs after `ready`, so `markComplete`/`markFailed` only touch
`ai_status` — never the video `status`. A video is watchable at `ready` even if AI later fails.

---

## 3. The data layer to build (the only remaining backend *logic*)

One module (e.g. `web/src/lib/videoRepository.ts`) implementing the injected dep functions
against Postgres. Use `coerceStoredSegments`/`coerceStoredChapters` on read to build `VideoRow`.

| Dep function | Used by | Behaviour |
|---|---|---|
| `insertVideo({slug, streamUid, status})` | createUpload | INSERT, return `{id}` |
| `findVideoById(id)` | uploadComplete, metadata | SELECT → `{id,status}` / full `VideoRow` |
| `findVideoByStreamUid(uid)` | webhook | SELECT by `stream_uid` → `{id,status}` |
| `findVideoBySlug(slug)` | watch | SELECT → `VideoRow` |
| `markProcessing(id)` | uploadComplete | `status = transition(cur,'processing')` |
| `markReady(id,{durationSeconds,thumbnail})` | webhook | `status→ready`, set `thumbnail`, **`stream_hls = cloudflareStreamUrls(subdomain, stream_uid).hls`** |
| `enqueueAiJob(id)` | webhook | enqueue (see §5) |
| `persistSummary(id,{title,summary,chapters,transcript})` | aiPipeline | UPDATE the AI fields |
| `markComplete(id)` | aiPipeline | `ai_status='complete'` |
| `markFailed(id,reason)` | aiPipeline | `ai_status='failed'`, `ai_error=reason` |

> DB-stack choice (node-postgres vs Prisma vs Drizzle) is open — the coercion layer and
> `VideoRow` are driver-agnostic. Integration-test the repository against a real
> `renovo_test_*`-style DB on hetznerCO (per the team convention), not local Docker.

---

## 4. Route files to add (Next.js app router, `web/src/app/`)

Each route parses the request, builds deps (from `loadConfig(process.env)` + the repository +
the clients wrapped in `withRetry`), calls the handler, returns the response. Wrap each network
client call: `withRetry(() => createDirectUpload(cfg, p), { isRetryable: isTransientHttpError })`.

| Route | Handler | Notable deps |
|---|---|---|
| `POST /api/uploads` | `createUpload` | `makeSlug`, `createStreamUpload` = retry(`createDirectUpload`), `insertVideo`, `watchBaseUrl` |
| `POST /api/uploads/[id]/complete` | `handleUploadComplete` | `findVideoById`, `markProcessing` |
| `POST /api/webhooks/stream` | `handleStreamWebhook` | `secret`, `findVideoByStreamUid`, `markReady`, `enqueueAiJob` |
| `GET /v/[slug]` (page) | `handleWatch` | `findVideoBySlug`, `watchBaseUrl` |
| `GET /api/videos/[id]` | `handleVideoMetadata` | `findVideoById`, `watchBaseUrl` |

**Client must call** `POST /api/uploads/[id]/complete` after its tus upload finishes — that is
the owner of `awaiting_upload → processing` (the Stream webhook only drives `processing → ready`).

---

## 5. AI worker

`enqueueAiJob(id)` → eventually `runAiPipeline(aiDeps, {videoId: id, audioUrl})`, where
`audioUrl = cloudflareStreamUrls(subdomain, stream_uid).mp4Download` and `callDeepgram`/`callClaude`
are the clients wrapped in `withRetry`. Simplest first cut: run synchronously after the webhook
acks (fire-and-forget) or a DB-polled worker. Note: the MP4 download URL requires Cloudflare Stream
**downloads enabled** for the video, and a publicly fetchable URL (mind `requireSignedURLs`).

---

## 6. Environment checklist (enforced by `config.ts`)

```
CLOUDFLARE_CO_ACCOUNT_ID        # connorodea Cloudflare account (Stream)
CLOUDFLARE_CO_API_TOKEN         # token with Stream:Edit
CF_STREAM_CUSTOMER_SUBDOMAIN    # customer-<code>.cloudflarestream.com (URL derivation)
CF_STREAM_WEBHOOK_SECRET        # Stream webhook signing secret
DEEPGRAM_API_KEY
ANTHROPIC_API_KEY
DATABASE_URL                    # Postgres on hetznerCO
WATCH_BASE_URL                  # public base, e.g. https://<host>  (no trailing slash)
```

All on the **connorodea** account / hetznerCO — no QuickLotz/QuickBidz resources anywhere.

## 7. Provisioning steps

1. **Cloudflare Stream (connorodea):** enable Stream; create a Stream:Edit token; note account id +
   customer subdomain; add a webhook → `POST {WATCH_BASE_URL}/api/webhooks/stream`, store its secret;
   enable MP4 downloads for the AI audio source.
2. **Postgres (hetznerCO):** create DB + app user, run the §2 DDL, set `DATABASE_URL`.
3. **Keys:** Deepgram + Anthropic.
4. **Build the data layer (§3)** and **route files (§4)**, plus the AI worker (§5).
5. **Deploy** to hetznerCO via the standard `HETZNER_CO_*` CI/CD (Next.js standalone; rsync incl.
   `node_modules` so `.prisma/client` isn't stale; secrets via GitHub Secrets).

## 8. Branch / merge plan

This work is a stack of ~35 small `feat/*` + `test/*` branches, each branched off the previous
and individually green. They are not yet merged. Recommended: review + merge in dependency order
into `main` (oldest first), or open one integration PR from the tip. Per repo policy, **do not merge
without explicit instruction**, and keep all branch/PR metadata neutral (no QL/QB references).

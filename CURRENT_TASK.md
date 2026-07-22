# LLM prompt-cache prefix fingerprinting — handoff (2026-07-22)

**Why:** debugging why the built-in `/my/llm/generate` proxy shows no provider
prompt-cache hits. We now fingerprint each request's prompt prefix so we can
later correlate which requests shared a prefix (and how much of it) — without
storing any message content.

**What landed (all in `apps/mythweavers-backend`):**
- `src/lib/prefix-hash.ts` (new) — `computePrefixHashes(messages)` returns
  `{ hashes: string[], breakpoints: number[] }`: cumulative per-message
  SHA-256 (first 16 bytes hex) chaining role+content, plus the indices that
  carried a `cache_control` breakpoint. Also `sharedPrefixLength(a, b)` for
  offline analysis. Cumulative ⇒ two requests share their first `k` messages
  iff their hash lists agree at `0..k-1`; longest match = shared-prefix length.
- `prisma/schema.prisma` — added `prefixHashes Json?` to `LlmUsageLog`.
  **MIGRATION NOT YET APPLIED.**
- `src/routes/my/llm.ts` — computes `prefixHashes` up front; settlement now
  creates an `LlmUsageLog` row for **every** request (including failed /
  zero-cost / aborted), storing `prefixHashes`. Billing is unchanged: the
  ledger row is still linked only when there's an actual charge; on no-charge
  the reservation ledger row is deleted (full refund) but the usage log is
  kept for debugging.
- `tests/prefix-hash.test.ts` (new) — 9 pure-function tests (cumulative
  property, cache-miss semantics, role sensitivity, NUL-separator collision,
  breakpoint indices). Pass. `prisma generate` run; `tsc --noEmit` ✓.

**What Bart needs to do:**
1. Apply the migration interactively (additive column — safe). Note this will
   also sweep up the other pending additive changes already listed below
   (`BalanceLedger.externalId`, `Scene.summarySegments`); all additive.
   ```
   cd apps/mythweavers-backend
   pnpm prisma migrate dev --name add_llm_usage_prefix_hashes
   ```
2. After migrating, run `pnpm --filter @mythweavers/backend test` to confirm
   the full suite (the prefix-hash unit tests already pass without the DB).

**Note on the caching investigation itself:** the `gpt-5_6-sol` / `-terra`
OpenAI-dashboard usage does NOT flow through this backend (local DB has zero
such rows and no OpenAI provider). That traffic is the front-end calling
OpenAI directly. This fingerprinting only captures requests that go through
`/my/llm/generate` (the `server` provider). To debug the direct browser→OpenAI
path, the front-end `OpenAICompatibleClient` would need equivalent logging.

---

# AI image generation for backgrounds — handoff (2026-05-01)

> 2026-07-19 backend-audit follow-up: `BalanceLedger.externalId String? @unique`
> was added for transactionally idempotent Stripe top-ups. The next interactive
> Prisma migration must include this additive column/unique constraint. Do not
> hand-write the migration; run
> `pnpm --filter @mythweavers/backend prisma:migrate --name add_balance_ledger_external_id`.

Adding the ability for authors to generate background images from text prompts,
plugging into the existing background pipeline (`defaultBackgroundFileId` on
Story / Book / Arc / Chapter / Scene).

Plan file: `~/.claude/plans/streamed-stirring-puzzle.md`

## What landed in this batch

**Schema (additive + one rename):**
- `apps/mythweavers-backend/prisma/schema.prisma`:
  - `LlmProvider` table renamed → `Provider`. Same columns; new back-relation
    `imageModels`. `LlmModel.providerId` and `LlmProviderTransaction.providerId`
    still work — Prisma handles FK retargets automatically.
  - `LlmProtocol` enum got two new values: `CLOUDFLARE_IMAGE` and
    `OPENAI_IMAGE`. The existing `CLOUDFLARE` value is kept (LLM use).
  - New `PricingMode` enum: `FLAT_PER_IMAGE | PER_MP_TIERED | PER_TILE_STEP`.
  - New `LedgerEntryType` value: `IMAGE_USAGE`.
  - New `BalanceLedger.imageUsageLogId` nullable column + relation.
  - New tables: `ImageModel`, `ImageUsageLog`.
- `pnpm --filter @mythweavers/backend prisma:generate` already run; types compile.

**`packages/llm`:**
- `src/types.ts` — added `ImageGenerateOptions`, `ImageGenerateResult`,
  `ImageUsage`, `ImageModelInfo`, `ImageClient`. Exported from `index.ts`.
- `src/clients/cloudflare.ts` — `CloudflareClient` now `implements LLMClient,
  ImageClient`. Added `listImageModels()` (uses `/models/search?task=Text-to-Image`)
  and `generateImage()` (POST `/run/@cf/<model>`, handles both binary and
  `{ result: { image: <base64> } }` responses).
- `src/clients/openai.ts` — new `OpenAIClient` implementing both interfaces.
  LLM side delegates to an internal `OpenAICompatibleClient`; image side hits
  `/v1/images/generations`. Hardcoded model list `gpt-image-1`, `dall-e-3`.

**Backend:**
- `src/lib/image-config.ts` — `resolveImageUpstream`, `getPublicImageModels`,
  `tilesFor`, `megapixelsFor`, `computeCost`, `estimateCost`, `estimateOurCost`.
  Mirrors `llm-config.ts`.
- `src/lib/image-clients.ts` — `createImageClient(upstream)` factory
  dispatching on `protocol`.
- `src/routes/my/images.ts` — `GET /my/images/models` (public catalog),
  `POST /my/images/generate` (the main endpoint). Includes:
  - Story-ownership check (404 on miss).
  - Width/height/steps clamping to model max.
  - Pre-flight balance check (402 on insufficient).
  - Per-user concurrency lock via `Map<number, AbortController>` (429 on dup).
  - Client-disconnect → upstream `AbortController.abort()` plumbing.
  - On success: `saveBuffer` outside the tx, then in one transaction: file
    create-or-dedup + ImageUsageLog + balance decrement + BalanceLedger entry.
  - Per-route `connectionTimeout: 90_000` for slower OpenAI gens.
- Route registered in BOTH `src/index.ts` and `tests/helpers.ts`.
- Cascading rename fixes: `src/routes/admin/llm.ts` (12 + 3 places),
  `src/lib/cost-sync-scheduler.ts`, `src/routes/my/usage.ts` Zod enum,
  `prisma/seed-llm-providers.ts`, `tests/admin-llm-balance.test.ts` —
  all `prisma.llmProvider.*` → `prisma.provider.*` and `provider.models` →
  `provider.llmModels`.

**Tests:**
- `tests/images.test.ts` — covers GET /models (auth, enabled-only),
  POST /generate happy path + 400 (validation, unknown model, disabled provider,
  missing env key), 401 (no auth), 402 (insufficient balance), 404 (foreign
  story / non-existent), 429 (concurrency), 502 (upstream error), width/height
  clamping, and per-user lock isolation. Uses `mock.module` to stub
  `createImageClient` so no real upstream is hit.

**Seed:**
- `prisma/seed-image-providers.ts` — idempotent seed with two providers and
  three models (Flux 1 Schnell, Flux 2 Klein 9B, gpt-image-1) at realistic
  pricing/cost.

**Backend typecheck**: `npx tsc --noEmit` ✓.

## What Bart needs to do

**1. Run the migration interactively.**

Prisma cannot generate this migration non-interactively because it needs to
confirm the `LlmProvider → Provider` table rename (Prisma can't tell rename
from drop+create without a hint).

```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name image_generation
```

When Prisma asks whether you want to rename `LlmProvider` to `Provider` (or
similar), accept the rename. **Do not let it drop and recreate.** All other
changes are additive (new tables, new columns, new enum values).

**2. Run the seed scripts** so the new providers/models exist:

```bash
cd apps/mythweavers-backend
npx tsx prisma/seed-image-providers.ts
```

(`seed-llm-providers.ts` is unchanged in behavior but its underlying Prisma
calls now use `prisma.provider.*` after the rename — re-running it is harmless.)

**3. Confirm backend tests pass.**

```bash
pnpm --filter @mythweavers/backend test tests/images.test.ts
```

Right now they all fail with `relation "public.ImageModel" does not exist`
because the migration hasn't run yet. Once it has, they should pass.

**4. Regenerate the story-editor SDK** (backend must be running on :3201):

```bash
pnpm dev:backend &
pnpm --filter @mythweavers/story-editor generate:client
```

The SDK will get `getMyImagesModels` and `postMyImagesGenerate` calls.

## What's still pending

The frontend Generate panel in `BackgroundOptionsModal.tsx` is **not yet built**.
The plan calls for:

- Tab toggle in the modal: "Library" (existing) ↔ "Generate" (new).
- Generate UI: prompt textarea, model `<select>` populated from
  `getMyImagesModels()`, optional size select, Generate button, inline preview.
- On click: `postMyImagesGenerate({ body: { storyId, prompt, model, width, height } })`,
  then call existing `setFileId(fileId)` so the existing Save button hits the
  background-set endpoint as before.
- Cost estimate next to the button using the public model catalog.
- Surface upstream errors verbatim in the existing error box.

Files to touch:
- `apps/mythweavers-story-editor/src/components/BackgroundOptionsModal.tsx`
- `apps/mythweavers-story-editor/src/components/BackgroundOptionsModal.css.ts`

Blocked on **step 4** above (SDK regen) — the typed calls don't exist yet.

## Smoke test plan once everything is hooked up

1. Set `LLM_CLOUDFLARE_API_KEY` + `LLM_CLOUDFLARE_ACCOUNT_ID` (already in your
   env if LLM use already works).
2. `pnpm dev` → open story-editor, BackgroundOptionsModal on a chapter.
3. Pick `Flux 1 Schnell`, prompt "fantasy forest at dusk, painterly",
   Generate → ~3s preview.
4. Save → reader page shows the background.
5. `pnpm db:studio` → confirm `ImageUsageLog` row, `BalanceLedger` row of type
   `IMAGE_USAGE`, and `User.balance` decremented.
6. Repeat with `gpt-image-1` (set `LLM_OPENAI_API_KEY` first).
7. Concurrency: trigger two gens back-to-back from same browser → second 429.

---

# Per-segment summaries for branching scenes — handoff (2026-05-02)

## Why

CYOA scenes can contain `branch` messages whose options jump to different
`targetMessageId`s. A single per-scene summary cannot represent multiple
paths through the same scene — once the reader takes a branch, the summary
either includes content from the path they didn't take, or omits content
they did read. Solution: split each scene into segments along the
branch-target graph and store one summary per segment.

## Segment definition

A segment is a maximal contiguous run of messages (in `sortOrder`) such that:
- the run starts at the scene's first message OR at a message that is
  `targetMessageId` of some branch option anywhere in the story;
- the run ends at a `branch` message (inclusive) OR at the message just
  before the next segment-start OR at the last message of the scene.

This is implemented in `apps/mythweavers-story-editor/src/utils/summarySegments.ts`
(`planSummarySegments`, `selectActiveSegments`, `collectBranchTargetMessageIds`).

## What landed

**Backend:**
- `apps/mythweavers-backend/prisma/schema.prisma` — added
  `summarySegments Json?` to `Scene`. **MIGRATION NOT YET APPLIED.**
- `apps/mythweavers-backend/src/routes/my/scenes.ts` — added
  `summarySegmentSchema`, threaded through `sceneSchema`,
  `createSceneBodySchema`, `updateSceneBodySchema`, `formatScene`, POST and
  PATCH handlers.
- `apps/mythweavers-backend/tests/scenes.test.ts` — round-trip test
  `should round-trip summarySegments` (PATCH set + clear). **Will fail
  until migration is applied.**

**Frontend:**
- `apps/mythweavers-story-editor/src/types/core.ts` — added `SummarySegment`
  interface and `summarySegments?: SummarySegment[] | null` on `Node`.
- `apps/mythweavers-story-editor/src/utils/summarySegments.ts` — pure helpers.
- `apps/mythweavers-story-editor/src/stores/nodeStore.ts` —
  `generateNodeSummary` rewritten to plan segments, summarize each via the
  passed `generateSummaryFn`, and persist both `summarySegments` (new
  authoritative array) and `summary` (joined fallback for legacy readers).
- `apps/mythweavers-story-editor/src/utils/contextGeneration.ts` — when
  emitting a marked previous scene with `includeInFull === 1`, prefers
  `summarySegments` filtered to the active path via `selectActiveSegments`,
  falls back to `node.summary`.

## What Bart needs to do

1. Apply migration interactively — Prisma refuses non-interactive in this
   env:
   ```
   cd apps/mythweavers-backend
   pnpm prisma migrate dev --name add_scene_summary_segments
   ```
2. Regenerate the OpenAPI client (backend must be running):
   ```
   cd apps/mythweavers-story-editor
   pnpm generate:client
   ```
3. Run backend scenes test to confirm:
   ```
   pnpm --filter @mythweavers/backend test tests/scenes.test.ts
   ```

## Follow-ups (out of scope this batch)

- **Stale per-scene summaries.** Existing scenes with branches still have a
  whole-scene `summary` and no `summarySegments`. Per Rule #8, no auto
  migration; the `contextGeneration` fallback uses the legacy `summary`
  string until the user regenerates. Worth telling authors to regenerate
  summaries on any branching scene.
- **Surface segments in the node-summary editor UI.** The settings/scene
  details modal currently shows `node.summary` only. Eventually editors
  should be able to see/edit per-segment summaries, with branch labels
  for orientation. Tracked nowhere yet — add to TODO.md if desired.
- **Pre-existing test infra issue:** `contextGeneration.test.ts` fails to
  load with `Cannot read properties of undefined (reading 'registerGraph')`
  from solid-js dev store. Pre-existing, not introduced by this work.

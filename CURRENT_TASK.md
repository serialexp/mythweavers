# Reader feature port — handoff (2026-04-28, second batch)

Continuation of the legacy-reader port. The previous handoff (3D flip card +
bookshelf) is fully landed; this batch adds the missing browse/auth/history
features Bart asked about.

## What landed in this batch

**Backend — DONE in code:**
- `apps/mythweavers-backend/prisma/schema.prisma` — `StoryReadStatus` got
  `@@unique([userId, storyId])` + `@@index([userId, updatedAt])`.
  **The reading-status idempotency tests depend on this constraint.**
- `apps/mythweavers-backend/src/routes/authors/public.ts` — new file:
  - `GET /authors?search=` — list authors with their published-story counts.
  - `GET /authors/:id` — author profile + their visible stories.
- `apps/mythweavers-backend/src/routes/auth/index.ts` — added
  `POST /auth/change-password` (verifies current via scrypt, generates fresh
  salt for the new hash; existing sessions stay valid).
- `apps/mythweavers-backend/src/routes/my/reading-status.ts` — new file:
  - `POST /my/reading-status` `{ storyId, chapterId }` — upserts (validates
    story is publicly visible → 404, chapter belongs to story → 400).
  - `GET /my/reading-status` — list filtered by `storyVisibleWhere(now)`.
  - `GET /my/reading-status/:storyId` — `{ lastChapterId, lastChapterReadAt }`.
- All three registered in BOTH `src/index.ts` and `tests/helpers.ts`.
- New tests: `tests/authors.test.ts`, `tests/auth-change-password.test.ts`,
  `tests/reading-status.test.ts`. Backend typecheck ✓.

**Frontend (Astro reader) — DONE in code:**
- `src/lib/api.ts` extended: `authorsApi`, `myFictionApi`, `settingsApi`,
  `readingStatusApi` + their types. SDK regenerated.
- `src/lib/writer-url.ts` — new helper. Hostname-swap rule: writer is at
  `write.{currenthost}` (or `localhost:3203` in dev).
- New SolidJS pages + Astro shells:
  - `/search` — query/status/type filters, paginated results.
  - `/authors` and `/authors/[id]` — list and profile.
  - `/my-fiction` — auth-required, lists stories the user owns, with
    "Edit in Writer" button using the hostname-swap rule.
  - `/settings` — auth-required, password-change form.
- `ChapterPage.tsx` — fires `readingStatusApi.record(storyId, chapterId)` on
  mount when the user is logged in (fire-and-forget; warnings logged).
- `HomePage.tsx` + `pages/index.astro` — new "Continue Reading" section,
  populated from `readingStatusApi.list({ cookie })` for logged-in users
  (capped to 5 entries).
- `Layout.tsx` — nav now includes Search, Authors, plus Bookshelf / My Fiction
  / Settings for logged-in users.
- Frontend build: `pnpm --filter @mythweavers/reading-frontend-astro build` ✓.

## What Bart needs to do

**1. Apply the Prisma migration.** Per CLAUDE.md I can't run migrations.
Purely additive (one unique index + one regular index), should not prompt
about data loss:
```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name reading_status_unique
```

**2. Run the backend tests** to confirm everything wires up:
```bash
pnpm --filter @mythweavers/backend test
```
The new test files (`authors.test.ts`, `auth-change-password.test.ts`,
`reading-status.test.ts`) will fail until the migration is applied because
the upsert relies on the new `@@unique([userId, storyId])` constraint.

**3. Smoke test the new pages** with `pnpm dev`:
- `/search?q=…` — verify search/status/type filters.
- `/authors` and `/authors/{id}` — list + profile pages.
- `/my-fiction` — log in, confirm your stories appear, click "Edit in Writer"
  → opens `http://localhost:3203/story/{id}` (or `https://write.{host}/...`
  in non-localhost).
- `/settings` — change your password; verify old fails and new works.
- Open a chapter while logged in → home page should show it under
  "Continue Reading" on next load.

## Notes / known gaps

- Writer link uses `window.location` so it can't be embedded in SSR HTML
  reliably; it lives in a `client:load` island, which is fine for the My
  Fiction page since the whole page is one island already.
- No cleanup yet of stale `StoryReadStatus` rows when a chapter is hard-
  deleted. Cascade-delete behaviour is whatever the existing FK declares —
  worth a glance if the model needs `onDelete: Cascade`.
- Search page deliberately doesn't auto-fire on every keystroke; it submits
  on Enter or "Search" click and round-trips the URL. That keeps SSR + back-
  button behaviour clean.
- WPW (words-per-week) filter from the legacy reader was intentionally
  dropped — confirmed with Bart.
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


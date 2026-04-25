# Pending Prisma migration: scene background images

A separate in-flight task (per-scene background images via a new
`Message.type = 'background'`) added these schema changes to
`apps/mythweavers-backend/prisma/schema.prisma`:

- `Message.backgroundFileId String?` + relation `MessageBackgroundFile`
  to `File`, with `onDelete: SetNull`.
- Reverse relation `messageBackgrounds` on `File`.
- Updated comment on `Message.type` to mention the new
  `'background'` value.

These need a Prisma migration. Bart, please run:

```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name add_message_background_file
```

**Note on drift:** the database currently has a `RoyalRoadAccount`
table and Royal-Road-related additions (`Story.royalRoadPublishingEnabled`,
new `PublishingStatus` enum variants, `ChapterPublishing.attempts` etc.)
that are NOT represented as a migration in `prisma/migrations/`.
Prisma reported this as drift when I tried to run the migration —
it wants to reset the schema. **Do not let it reset.** Resolve the
drift first (likely `prisma migrate diff` to write a backfill
migration capturing the existing state, then apply mine on top). The
Prisma client has already been regenerated locally so code referencing
`backgroundFileId` typechecks.

Plan file: `~/.claude/plans/humble-dancing-koala.md`.

---

# Current Task: Publishing flow (writer → Astro reader) + daily email digest

## Status: Phase 1 schema drafted — NEEDS PRISMA MIGRATION before further work

---

## The goal

Let authors in the story-editor set a `publishedAt` timestamp (immediate or scheduled) on stories and chapters. The Astro reading frontend only shows content where `publishedAt <= now()` at both the story level AND the chapter level. A daily UTC cron sends an email digest of new chapters to users who have the story on their bookshelf with `kind = FOLLOW`.

Royal Road publishing is explicitly out of scope here — legacy implementation stays as reference only (`apps/writer-legacy-backend/src/procedures/publish-to-royal-road.ts`).

## Decisions (locked in with Bart)

- **Publishing field**: unified `publishedAt: DateTime?` on Story + Chapter only (Book/Arc skipped — noise at those levels).
- **Visibility rule**: chapter visible iff `chapter.publishedAt <= now && story.publishedAt <= now`. `null` = unpublished. Future = scheduled.
- **Reader behavior**: always queries backend (same source of truth as writer); fully dynamic SSR; backend returns `ETag`/`Last-Modified` so reader can serve 304s.
- **Notifications**: daily UTC digest via Postmark (already in pnpm-lock but unused). No immediate notifications, no push, no RSS for v1.
- **Follows**: reuse existing `BookShelfStory` with `kind = FOLLOW`. Minimal add/remove/list endpoints only — full bookshelf UI deferred (see TODO.md).
- **Worker architecture**: digest runs in-process inside the backend for now, but structured as a cleanly separable worker (own bootstrap entrypoint) so it can be split into its own Dockerfile target later without refactoring. Strict one-way dependency: worker imports Prisma + email lib, never Fastify routes.

## Phase 1 — Schema (DRAFTED — migration pending)

### What I changed in `apps/mythweavers-backend/prisma/schema.prisma`

- `Story.publishedAt: DateTime?` added. Old `Story.published: Boolean` marked `@deprecated` in a doc comment but kept in schema so Migration 1 is purely additive (no data loss).
- `Chapter.publishedAt: DateTime?` added. Old `Chapter.publishedOn: DateTime?` marked `@deprecated` but kept.
- `@@index([publishedAt])` added to `Chapter` — the digest query scans "chapters with publishedAt in the last 24h" and needs this index.

### What Bart needs to do

**Step 1: Generate and run Migration 1 (additive — safe):**

```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name add_published_at_to_story_and_chapter
```

Because this migration only ADDS nullable columns and an index, Prisma should not prompt about data loss. If it does, something's wrong — stop and check.

**Step 2: Backfill existing data (one-shot SQL, run via `pnpm db:studio` console, `psql`, or a Prisma script):**

```sql
-- Any story currently marked published goes live immediately (createdAt is a reasonable fallback)
UPDATE "Story" SET "publishedAt" = "createdAt" WHERE "published" = true AND "publishedAt" IS NULL;

-- Chapters get their existing publishedOn copied over
UPDATE "Chapter" SET "publishedAt" = "publishedOn" WHERE "publishedOn" IS NOT NULL AND "publishedAt" IS NULL;
```

After this, the code work in Phase 2+ reads/writes **only** `publishedAt`. The old `published` / `publishedOn` fields become write-through fallbacks from the new endpoints (to stay consistent during the transition) or just left alone if nothing writes them.

**Migration 2 (LATER, only after Phase 2-6 are done and verified):** drop `Story.published` and `Chapter.publishedOn`. A separate task.

---

## Upcoming phases (not started — rough scope)

### Phase 2 — Backend: writer-facing publishing endpoints
Under `apps/mythweavers-backend/src/routes/my/`:
- `PATCH /my/stories/:storyId/publishing` — body `{ publishedAt: string | null }`
- `PATCH /my/chapters/:chapterId/publishing` — body `{ publishedAt: string | null }`
- `POST /my/stories/:storyId/publish-now`, `POST /my/stories/:storyId/unpublish` (convenience)
- `POST /my/chapters/:chapterId/publish-now`, `POST /my/chapters/:chapterId/unpublish` (convenience)
- Full tests per backend CLAUDE.md. Register in `src/index.ts` AND `tests/helpers.ts`.
- Any publish mutation should also update `Story.firstChapterReleasedAt` / `lastChapterReleasedAt` (these fields already exist and nothing currently maintains them — opportunity to fix).

### Phase 3 — Backend: public reader endpoints (fix existing leak)
- `apps/mythweavers-backend/src/routes/stories/public.ts` currently filters `Story.published: true` only, so chapters of a live story are ALL returned regardless of `publishedOn`. This is a pre-existing bug (Rule #0.5).
- Update queries to filter `story.publishedAt != null AND publishedAt <= now AND chapter.publishedAt != null AND chapter.publishedAt <= now`.
- Add `ETag` header computed from `max(publishedAt)` across returned rows + response shape hash. Honor `If-None-Match` → 304.
- Tests specifically for the leak fix: "scheduled chapter must NOT appear in public response".

### Phase 4 — Writer UI (story-editor)
- New `publishingStore` in `apps/mythweavers-story-editor/src/stores/` (Rule #9: store, not prop drilling).
- Per-chapter badge in the tree (Draft / Scheduled X / Published X) + context menu (Publish now / Schedule… / Unpublish).
- Story-level publish controls in settings panel.
- Dedicated "Publishing" panel: flat schedule view of all chapters in a story with their status and upcoming publish times.
- All persistence via `saveService` — never bypass.
- Regenerate SDK via `pnpm generate:client` after Phase 2 lands.

### Phase 5 — Reader (Astro) wiring
- Pass through `If-None-Match` from incoming request to backend; honor 304.
- No client-side filtering — trust backend.
- Fully dynamic SSR as requested.

### Phase 6 — Follow endpoints (minimal)
- `POST /my/bookshelf` `{ storyId, kind }`
- `DELETE /my/bookshelf/:id`
- `GET /my/bookshelf?kind=FOLLOW`
- Full tests.
- No UI — file reader-side bookshelf UI under TODO.md.

### Phase 7 — Email + daily digest worker
- New schema additions (Migration 3):
  - `User.emailDigestEnabled: Boolean @default(true)`
  - `User.digestUnsubscribeToken: String?` (lazy-generated, unique)
  - `EmailDigestLog` model — idempotency guard so a worker restart doesn't double-send.
- New package OR backend lib (`apps/mythweavers-backend/src/lib/email/`) wrapping Postmark.
- Env: `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `PUBLIC_READER_URL`.
- New `apps/mythweavers-backend/src/workers/` with own bootstrap. Daily cron (UTC) via `node-cron` or `fastify-schedule`. Queries chapters with `publishedAt` in last 24h, joins to `BookShelfStory` with `FOLLOW`, groups per user, sends one email each.
- Each email includes a one-click unsubscribe link using `User.digestUnsubscribeToken`.

## Out of scope / deferred (TODO.md)
- Reader-side bookshelf / follow UI
- Per-user timezone for digest
- Web push / in-app notifications
- Royal Road port
- Cleanup of dead `publishToRoyalRoad` fields in `apps/shared/src/schema.ts`
- Migration 2 (dropping `Story.published` and `Chapter.publishedOn` after cutover)

## Picking up where this left off

1. Bart runs Prisma migration + backfill SQL above.
2. Regenerate Prisma client: `pnpm --filter @mythweavers/backend prisma:generate`
3. Start Phase 2: write the four `/my/.../publishing` endpoints with full tests.

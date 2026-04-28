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

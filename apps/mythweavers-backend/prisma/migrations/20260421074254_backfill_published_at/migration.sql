-- Backfill `publishedAt` on Story and Chapter from their legacy fields.
--
-- Context: the previous migration (20260421070728_new_publish_dates) added
-- the new `publishedAt` columns alongside the legacy `published` (Story) and
-- `publishedOn` (Chapter) fields. This migration copies existing data over so
-- the application can read solely from `publishedAt` going forward.
--
-- Idempotent: every UPDATE guards with `"publishedAt" IS NULL` so re-running
-- (or running after a manual backfill) is a no-op.
--
-- A later migration will drop the legacy `published` and `publishedOn` columns
-- once all code paths have been cut over.

-- Any story previously flagged as published becomes publicly visible immediately.
-- `createdAt` is a reasonable proxy for "has been live since forever" — better
-- than NOW() because it preserves the historical ordering (e.g. ETag/Last-Modified
-- derivations based on max(publishedAt) stay meaningful).
UPDATE "Story"
SET "publishedAt" = "createdAt"
WHERE "published" = true
  AND "publishedAt" IS NULL;

-- Chapters copy their existing scheduled/published timestamp verbatim.
UPDATE "Chapter"
SET "publishedAt" = "publishedOn"
WHERE "publishedOn" IS NOT NULL
  AND "publishedAt" IS NULL;

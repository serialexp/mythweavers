-- `Map.fileId` has been a bare `String?` with no foreign key, so nothing ever
-- stopped it pointing at a `File` row that had since been deleted. Postgres
-- refuses to add a foreign key that existing rows already violate, so the
-- dangling references have to go first or this migration fails on any database
-- that has one -- which production does.
--
-- Null the reference rather than deleting the `Map`: the file is already gone,
-- but the map still owns its landmarks, pawns and paths, and dropping the row
-- would cascade all of those away to reclaim an image that no longer exists.
-- A null renders as "This map has no image yet", which is the truth.
UPDATE "Map"
SET "fileId" = NULL
WHERE "fileId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "File" WHERE "File"."id" = "Map"."fileId");

-- AddForeignKey
ALTER TABLE "Map" ADD CONSTRAINT "Map_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

# Migration Scripts

Scripts to migrate data from Writer and Story backends to the Unified Backend.

## Overview

There are two source systems that need migration:

1. **Writer Frontend** - SolidJS/Tauri app storing stories as JSON files
2. **Story Backend** - SQLite-based backend for the story generation project

Both migrate to the **Unified Backend** which uses PostgreSQL.

## Prerequisites

1. Ensure the unified backend database is set up:
   ```bash
   cd apps/unified-backend
   pnpm prisma migrate deploy
   ```

2. Create a user in the unified backend to own the migrated stories

3. Install dependencies:
   ```bash
   pnpm install
   ```

## Migration: Writer Frontend → Unified Backend

### Source Format
Writer stores stories as a directory structure:
```
story-project/
├── index.json          # Main story metadata + structure
├── scene/
│   └── {sceneId}.json  # Individual scene files
├── chapter/
│   └── {chapterId}.json
├── book/
│   └── {bookId}.json
├── arc/
│   └── {arcId}.json
├── characters/
│   └── {characterId}.json
├── locations/
│   └── {locationId}.json
└── plotPoints/
    └── {plotPointId}.json
```

### Key Transformations

| Writer Frontend | Unified Backend |
|----------------|-----------------|
| `Scene.paragraphs[]` | `Message → MessageRevision → Paragraph → ParagraphRevision` |
| `Location` | `ContextItem` (type: 'location') |
| `PlotPoint` | `ContextItem` (type: 'plot') |
| `Character.summary` | `Character.description` (for AI generation) |
| `Scene.characterIds` + `referredCharacterIds` | `Scene.activeCharacterIds` (JSON array) |
| `Scene.locationId` + `selectedContextNodes` | `Scene.activeContextItemIds` (JSON array) |

### Usage

```bash
# Dry run (no database changes)
npx tsx scripts/migrate/from-writer.ts /path/to/story-project 1 --dry-run

# Actual migration
npx tsx scripts/migrate/from-writer.ts /path/to/story-project 1

# Re-migrate (delete existing and re-import)
npx tsx scripts/migrate/from-writer.ts /path/to/story-project 1 --replace

# Arguments:
#   /path/to/story-project  - Path to Writer story directory
#   1                       - User ID (int) in unified backend
#   --dry-run              - Optional: don't make database changes
#   --replace              - Optional: delete existing story and re-import
```

**Re-migration behavior:**
- The original story ID is stored in `importedFromId` field on the unified Story record
- Without `--replace`: If a story with the same source ID already exists, it will be skipped
- With `--replace`: Existing story will be deleted and re-imported fresh

After successful migration, a `migration-mappings.json` file is saved in the story directory with old→new ID mappings.

---

## Migration: Story Backend → Unified Backend

### Source Format
Story backend uses SQLite with Prisma, featuring:
- Message-based content with versions
- Hierarchical Nodes (book/arc/chapter)
- Timeline and calendar support
- Map system (Landmarks, Fleets, Hyperlanes)

### Key Transformations

| Story Backend | Unified Backend |
|--------------|-----------------|
| `User` (cuid string) | `User` (auto-increment int) - requires user mapping |
| `Message` | `Message → MessageRevision → Paragraph → ParagraphRevision` |
| `Node` (book/arc/chapter) | Separate `Book`, `Arc`, `Chapter` tables |
| `Fleet` | `Pawn` (renamed) |
| `Fleet.hyperdriveRating` | `Pawn.speed` |
| `Hyperlane` | `Path` (renamed) |
| `HyperlaneSegment` | `PathSegment` |
| `Calendar.config` (JSON string) | `Calendar.config` (JSONB) + `name` extracted |

### Usage

```bash
# Set environment variables
export SOURCE_DATABASE_URL="file:../story-backend/prisma/dev.db"
export DATABASE_URL="postgresql://..."

# Dry run
npx tsx scripts/migrate/from-story.ts <source-user-cuid> <target-user-id> --dry-run

# Migrate all stories for a user
npx tsx scripts/migrate/from-story.ts <source-user-cuid> <target-user-id>

# Migrate specific story
npx tsx scripts/migrate/from-story.ts <source-user-cuid> <target-user-id> <story-id>

# Re-migrate (delete existing and re-import)
npx tsx scripts/migrate/from-story.ts <source-user-cuid> <target-user-id> --replace

# Arguments:
#   source-user-cuid  - User ID (cuid) from story-backend SQLite
#   target-user-id    - User ID (int) in unified-backend PostgreSQL
#   story-id         - Optional: specific story to migrate
#   --dry-run        - Optional: don't make database changes
#   --replace        - Optional: delete existing stories and re-import
```

**Re-migration behavior:**
- The original story ID is stored in `importedFromId` field on the unified Story record
- Without `--replace`: Stories with matching source IDs already in unified backend will be skipped
- With `--replace`: Existing stories will be deleted and re-imported fresh

---

## Data Model Comparison

### Story Hierarchy

```
Writer Frontend:
  Story → structure[] (tree of Nodes)
    Node (type: book/arc/chapter/scene)
      → Book, Arc, Chapter, Scene data in separate records

Story Backend:
  Story → nodes[] (flat with parentId)
    Node (type: book/arc/chapter)
      → Messages belong to chapter nodes

Unified Backend:
  Story → Book[] → Arc[] → Chapter[] → Scene[] → Message[]
    → MessageRevision[] → Paragraph[] → ParagraphRevision[]
```

### Content Model

```
Writer Frontend:
  Scene
    → paragraphs[] (inline array)
      → SceneParagraph (text, state, comments, actions)

Story Backend:
  Message
    → content (text)
    → paragraphs (JSON blob)
    → versions[] (MessageVersion)

Unified Backend:
  Scene
    → Message[] (one per conceptual paragraph)
      → MessageRevision[] (versions)
        → Paragraph[]
          → ParagraphRevision[] (edit history)
            → ParagraphComment[]
            → ParagraphEmbedding[]
```

### Story Elements

```
Writer Frontend:
  - Character (rich metadata: personality, background, etc.)
  - Location (name, picture, description)
  - PlotPoint (title, summary, state)
  - Item (story-level)

Story Backend:
  - Character (minimal: name, description, birthdate)
  - ContextItem (type-based: theme/location/plot/custom)

Unified Backend:
  - Character (merged: rich metadata + birthdate)
  - ContextItem (type-based, replaces Location + PlotPoint)
  - Item (owned by Character)
```

---

## Shared Utilities

`utils.ts` provides:
- `generateCuid()` - ID generation
- `transform*()` - Value transformations (perspective, state, etc.)
- `IdMapper` - Track old→new ID mappings
- `createConsoleLogger()` - Progress logging
- `processBatch()` - Batch processing helper
- `contentSchemaToText()` - ProseMirror content extraction

---

## Error Handling

Both scripts:
1. Collect errors without stopping migration
2. Report all errors at the end
3. Save ID mappings even on partial success
4. Support `--dry-run` for testing

Common errors:
- Missing parent nodes (orphaned arcs/chapters)
- Invalid references (deleted characters/locations)
- Parse errors in JSON fields

---

## Post-Migration

1. **Verify data**: Check story counts and content in unified backend
2. **Update references**: Use ID mappings to update any external references
3. **Test functionality**: Open migrated stories in the new app
4. **Clean up**: Archive source data once verified

---

## Notes

### Items Migration
Writer uses story-level items, but Unified uses character inventory. Story-level items are skipped during migration - decide on the approach based on your needs.

### Embeddings
Paragraph embeddings from Story Backend are not migrated by default as they require regeneration with the new ID structure.

### Files
File references are preserved but files themselves need separate migration (copy from source to unified storage).

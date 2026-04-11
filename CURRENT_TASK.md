# Current Task: Global vs Story-Level AI Settings

## Status: Implementation Complete — Needs Prisma Migration

## What Was Done

Separated global user preferences from story-level AI settings to fix a bug where model overrides set on one browser wouldn't appear on another (because `syncFromStory()` was overwriting global preferences with story-specific values, which then got synced back to the server).

### Architecture (3-layer settings)

1. **Global preferences** (`settingsStore`) - user's defaults, synced to `User.preferences` on backend. Never mutated by story loading.
2. **Story overrides** (`currentStoryStore.aiOverrides`) - per-story overrides stored in `Story.aiOverrides` JSON column. `null` = inherit global.
3. **Effective settings** (`effectiveSettings`) - computed merge: `storyOverride ?? globalDefault`. All consumers read from here.

### Key Changes

**New files:**
- `src/stores/effectiveSettingsStore.ts` - Read-only reactive getters + inline setters that write to story or global depending on context
- `src/components/AISettingsPanel.css.ts` - Styles for global/story toggle

**Backend:**
- Added `aiOverrides Json?` column to Story model in Prisma schema
- Added `aiOverrides` to story response schema, update body schema, and export schema

**Frontend stores:**
- Removed `syncFromStory()` from `settingsStore` (root cause of the original bug)
- Removed cross-store syncing from `setModel`/`setProvider` on `settingsStore`
- Added `aiOverrides`, `loadAIOverrides`, `setAIOverride`, `clearAllAIOverrides` to `currentStoryStore`
- Added `aiOverrides` to `CurrentStory` and `SavedStory` types
- Added `aiOverrides` to save payload and save service

**All generation consumers switched from settingsStore to effectiveSettings:**
- resolveModel, useStoryGeneration, useOllama, useAdventureEngine, AdventureHeader, SetupScreen, QuickLlmDialog, NewAdventureForm, AdventureList, copyPreviewStore, StoryStats, StoryNavigation, StoryHeader, LandmarkDetail, App.tsx, modelsStore, TokenSelector, MessageRegenerateButton, StoryInput

**UI:**
- AI Settings panel shows Global/Story toggle when a story is loaded
- Models section supports story-level overrides for: provider, model, maxTokens, thinkingBudget
- CategoryModelOverrides supports story-level overrides
- Inline controls (token selector, thinking toggle, provider/model) write to story override when in a story
- ProviderSelector accepts optional provider/setProvider props

## What Bart Needs To Do

### 1. Run Prisma Migration
```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name add_story_ai_overrides
```

### 2. Regenerate API Client
After the backend picks up the schema change:
```bash
cd apps/mythweavers-story-editor
pnpm generate:client
```

### 3. Test
- Load a story, change model → verify global prefs are untouched
- Open AI Settings → toggle Global/Story → verify both scopes work
- Inline controls (token selector, thinking toggle) should set story overrides
- Second browser should show correct global preferences

# Snowflake outliner: global detail-level toggle + scene-split action

## Context

The snowflake view (`apps/mythweavers-story-editor/src/components/snowflake/`) shows the
node tree (book → arc → chapter → scene) with each node's `summary` in an editable
textarea (`SnowflakeInput`). A node's detail "level" (L1/L2/L3) is **inferred** from the
summary's sentence count (`determineRefinementLevel` in `actions/parse.ts`):
≤1 sentence → L1, 2–4 → L2, 5+ → L3. A badge (`L1`/`L2`/`L3`) shows the inferred level.

Two asks:

1. **Global detail-level toggle** — switch *all* summaries' display between max L1 / L2 / L3,
   so you can scan/edit just the one-liners across the whole outline at once.
2. **Scene-split action** — surface the existing "Split into Chapters/Scenes" (from
   `StoryNavigation` → `SplitSceneModal`) on scene nodes in the snowflake view.

---

## Feature A — Global detail-level toggle

### Store (`store.ts`)
- Add `displayLevel: RefinementLevel` (default `3`) to `SnowflakeUIState` + a
  `displayLevel()` getter and `setDisplayLevel(level)` on `snowflakeStore`.
  This is transient view state — fits the store's existing remit.

### Toolbar UI (`SnowflakeView.tsx`)
- Add a segmented control in the toolbar: three buttons `L1` / `L2` / `L3`.
  Active button highlighted. Tooltip text from `LEVEL_DESCRIPTIONS`.
  Reuse the existing `styles.actionButton` + a new `actionButtonActive` variant
  (no new dependency needed; `ButtonGroup` exists but has no selected-state, so a
  3-button row with an active style is cleaner here).

### Display + editing in `SnowflakeInput`
- New helper `sliceToLevel(text, level): { visible, tail }` in `actions/parse.ts`:
  splits the summary at the sentence boundary after the Nth sentence
  (N = 1 for L1, 4 for L2), returning the exact visible prefix + the literal tail.
  For L3 (or short summaries) `visible = text, tail = ''`.
- `SnowflakeInput` reads `snowflakeStore.displayLevel` and shows `visible`.
- **Editing semantics (see Decision below).**

### ⚒️ DECISION — editing behaviour when zoomed below a node's real level

The summary is a single text field; "L1" of an L3 node is conceptually its first
sentence (the snowflake seed). Two viable options:

- **Option B (recommended): editable slice.** At L1/L2 you edit only the visible
  sentences; the hidden tail is preserved. Tail is captured when editing *begins*
  (on focus), held locally, and stitched back on every debounced write
  (`full = draft + tail`). Lets you do exactly what you described — rapidly tweak
  every chapter's one-liner without disturbing the elaboration underneath.
  Cost: ~30 lines of focus/tail-capture logic in `SnowflakeInput`, plus the
  `sliceToLevel` helper + unit tests.

- **Option A (simpler): read-only when collapsed.** At L1/L2 the field is
  read-only and shows a "…N more" hint; to edit you switch to L3 (or click a
  per-item expand). Much less code, but you can't edit one-liners in-place —
  you'd lose the "quickly modify the L1" workflow you asked for.

**My recommendation is Option B** because it directly matches "modify the L1".
I'll only build A if you prefer it.

### Minor choice
- Apply the toggle to **node summaries only** (via `SnowflakeInput`). The top
  "Story concept" textarea uses a separate component; I'd leave it always-full
  (it's the root seed). Say the word if you want it to follow the toggle too.

---

## Feature B — Scene-split action on snowflake

The split is already fully built (`SplitSceneModal` + `sceneSplitUtils.applyProposedStructure`).
It reads from global stores (`nodeStore`, `messagesStore`, `currentStoryStore`,
`saveService`) and only needs `isOpen` / `onClose` / `targetNodeId` props — so it
works unchanged from the snowflake route.

### Wiring
1. `SnowflakeItemActions.tsx` — add a `DropdownItem` "Split into Chapters/Scenes"
   (scissors icon, `PhScissorsIcon`) shown only when `node.type === 'scene'`,
   calling a new `props.onSplitScene(node.id)`. Placed in the "more" (⋮) dropdown
   alongside Add/Insert/Delete, mirroring `StoryNavigation`.
2. Thread `onSplitScene` through the recursion: `SnowflakeView` → `SnowflakeItem`
   (recursive) → `SnowflakeItemActions`. Single `(nodeId) => void` handler.
3. `SnowflakeView.tsx` — local `splitTargetId` + `showSplitScene` signals, render
   `<SplitSceneModal>` at the bottom. On close, clear both.

After a split, `nodeStore` mutates reactively (original scene removed, new
chapters/scenes added under the arc/book), so the outline refreshes on its own.

---

## Files touched
- `components/snowflake/store.ts` — `displayLevel` state + setter
- `components/snowflake/Snowflake.css.ts` — toolbar segmented-control + active style
- `components/snowflake/SnowflakeView.tsx` — toolbar toggle control + split modal/state
- `components/snowflake/SnowflakeItem.tsx` — pass `onSplitScene` down + into actions
- `components/snowflake/SnowflakeItemActions.tsx` — split-scene dropdown item
- `components/snowflake/SnowflakeInput.tsx` — level-aware display + (Option B) slice editing
- `components/snowflake/actions/parse.ts` — `sliceToLevel` helper
- `components/snowflake/actions/parse.test.ts` (new or existing test file) — unit tests
  for `sliceToLevel`

## Non-goals
- No schema / backend changes (level stays inferred, summary stays one field).
- No change to the Refine/Expand/Summarize AI actions.
- Royal Road / publishing untouched.

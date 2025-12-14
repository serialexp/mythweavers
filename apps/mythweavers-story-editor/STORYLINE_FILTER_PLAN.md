# Storyline Filter Implementation Plan

## Overview
Add ability to assign chapters to one or more storylines (plot threads) and filter the chapter tree to highlight chapters belonging to a selected storyline.

## User Experience
- Storylines are context items with `type: "plot"`
- Each storyline has a name and description (e.g., "Ahsoka's fall to the dark side")
- Chapters can be assigned to multiple storylines
- A dropdown in StoryHeader lets you select one storyline to highlight
- Highlighted chapters show blue text in the navigation tree
- Selection resets on page reload (no persistence needed)

## Data Model

### Context Items
- Already have `type` field supporting "theme" and "location"
- Add "plot" as third type for storylines
- Stored in `node.activeContextItemIds` alongside other context items

### Storage Strategy
- Use existing `activeContextItemIds` array on Node
- No new database fields needed
- Plot-type items and non-plot items share the same array
- Each dialog must preserve the other's selections when saving

## Implementation Steps

### 1. Update Types
**File:** `src/types/core.ts`

```typescript
// Line 96: Update ContextItem type
type: "theme" | "location" | "plot";
```

**File:** `backend/prisma/schema.prisma`

```
// Line 174: Update comment to include 'plot'
type        String   // 'theme' | 'location' | 'plot' | 'custom'
```

### 2. Update ContextItems Component
**File:** `src/components/ContextItems.tsx`

Add "Plot" radio button alongside Theme and Location:
- Lines 15, 20, 40, 64: Update type unions to include 'plot'
- Lines 234-253: Add third radio button for Plot type
- Lines 153-172: Add third radio button in edit form

### 3. Add Storyline Picker to NodeHeader
**File:** `src/components/NodeHeader.tsx`

Add after viewpoint selector (after line 631):

```typescript
// Add signal
const [isSelectingStorylines, setIsSelectingStorylines] = createSignal(false);

// Add memo for storylines (plot-type context items)
const storylines = createMemo(() =>
  contextItemsStore.contextItems.filter(item => item.type === 'plot')
);

// Get active storylines for this chapter
const activeStorylines = createMemo(() => {
  if (props.node.type !== 'chapter' || !props.node.activeContextItemIds) {
    return [];
  }
  const activeIds = new Set(props.node.activeContextItemIds);
  return storylines().filter(s => activeIds.has(s.id));
});

// Handler to toggle storyline
const handleToggleStoryline = (storylineId: string) => {
  const currentIds = props.node.activeContextItemIds || [];

  // Preserve non-plot items
  const nonPlotIds = currentIds.filter(id => {
    const item = contextItemsStore.contextItems.find(i => i.id === id);
    return item && item.type !== 'plot';
  });

  // Toggle the selected storyline
  const plotIds = currentIds.filter(id => {
    const item = contextItemsStore.contextItems.find(i => i.id === id);
    return item && item.type === 'plot';
  });

  let newPlotIds: string[];
  if (plotIds.includes(storylineId)) {
    newPlotIds = plotIds.filter(id => id !== storylineId);
  } else {
    newPlotIds = [...plotIds, storylineId];
  }

  nodeStore.updateNode(props.node.id, {
    activeContextItemIds: [...nonPlotIds, ...newPlotIds]
  });
};

// In dropdown menu, add button (after viewpoint selector)
<Show when={props.node.type === "chapter" && !isSelectingStorylines()}>
  <button onClick={() => setIsSelectingStorylines(true)}>
    <BsGlobe />
    {activeStorylines().length > 0
      ? `Storylines (${activeStorylines().length})`
      : 'Assign Storylines'}
  </button>
</Show>

<Show when={isSelectingStorylines()}>
  <div class={styles.viewpointSelector}>
    <div class={styles.viewpointHeader}>Select Storylines:</div>
    <For each={storylines()}>
      {(storyline) => {
        const isActive = () => (props.node.activeContextItemIds || []).includes(storyline.id);
        return (
          <label class={styles.viewpointOption}>
            <input
              type="checkbox"
              checked={isActive()}
              onChange={() => handleToggleStoryline(storyline.id)}
            />
            {storyline.name}
          </label>
        );
      }}
    </For>
    <Show when={storylines().length === 0}>
      <p style={{ padding: '8px', opacity: 0.6 }}>
        No storylines defined. Add plot-type context items first.
      </p>
    </Show>
    <button
      class={styles.viewpointCancel}
      onClick={(e) => {
        e.stopPropagation();
        setIsSelectingStorylines(false);
      }}
    >
      Done
    </button>
  </div>
</Show>
```

Display active storylines in metadata section (around line 490):
```typescript
<Show when={activeStorylines().length > 0}>
  <div class={styles.activeContextSection}>
    <span class={styles.contextLabel}>Storylines:</span>
    <span class={styles.contextList}>
      {activeStorylines().map(s => s.name).join(', ')}
    </span>
  </div>
</Show>
```

### 4. Update ChapterContextManager
**File:** `src/components/ChapterContextManager.tsx`

**Line 124:** Filter out plot-type items from the list:
```typescript
<For each={contextItemsStore.contextItems.filter(item => !item.isGlobal && item.type !== 'plot')}>
```

**Line 40-48:** Update `toggleContextItem` to preserve plot items:
```typescript
const toggleContextItem = (itemId: string) => {
  setSelectedContextItemIds(prev => {
    if (prev.includes(itemId)) {
      return prev.filter(id => id !== itemId)
    } else {
      return [...prev, itemId]
    }
  })
}
```

**Line 62-68:** Update `handleSave` to merge with plot items:
```typescript
const handleSave = () => {
  // Preserve plot-type items
  const currentIds = props.chapterNode.activeContextItemIds || [];
  const plotIds = currentIds.filter(id => {
    const item = contextItemsStore.contextItems.find(i => i.id === id);
    return item && item.type === 'plot';
  });

  nodeStore.updateNode(props.chapterNode.id, {
    activeCharacterIds: selectedCharacterIds(),
    activeContextItemIds: [...plotIds, ...selectedContextItemIds()]
  })
  props.onClose()
}
```

### 5. Add Storyline Filter to StoryHeader
**File:** `src/components/StoryHeader.tsx`

Create new store for storyline filter:

**File:** `src/stores/storylineFilterStore.ts` (new file)
```typescript
// ABOUTME: Store for managing storyline filter selection in chapter tree
// ABOUTME: Tracks which storyline (if any) should be highlighted in navigation

import { createSignal } from 'solid-js';

const [selectedStorylineId, setSelectedStorylineId] = createSignal<string | null>(null);

export const storylineFilterStore = {
  selectedStorylineId,
  setSelectedStorylineId,
  clearFilter: () => setSelectedStorylineId(null),
};
```

In StoryHeader, add dropdown after view mode selector (after line 357):

```typescript
import { storylineFilterStore } from '../stores/storylineFilterStore';

// Add signal for dropdown
const [showStorylineMenu, setShowStorylineMenu] = createSignal(false);

// Get all plot-type context items
const storylines = createMemo(() =>
  contextItemsStore.contextItems.filter(item => item.type === 'plot')
);

// In header config section, add dropdown
<Show when={messagesStore.hasStoryMessages && storylines().length > 0}>
  <div class={styles.viewModeContainer}>
    <HeaderButton
      onClick={() => setShowStorylineMenu(!showStorylineMenu())}
      title="Filter by storyline"
      variant={storylineFilterStore.selectedStorylineId() ? "active" : "default"}
    >
      <BsGlobe />
      <BsChevronDown style={{ "margin-left": "4px", "font-size": "12px" }} />
    </HeaderButton>
    <Show when={showStorylineMenu()}>
      <div class={styles.viewModeDropdown}>
        <button
          class={`${styles.dropdownItem} ${!storylineFilterStore.selectedStorylineId() ? styles.activeMode : ''}`}
          onClick={() => {
            storylineFilterStore.clearFilter();
            setShowStorylineMenu(false);
          }}
        >
          All Chapters
          {!storylineFilterStore.selectedStorylineId() && <BsCheck />}
        </button>
        <div class={styles.dropdownDivider}></div>
        <For each={storylines()}>
          {(storyline) => (
            <button
              class={`${styles.dropdownItem} ${storylineFilterStore.selectedStorylineId() === storyline.id ? styles.activeMode : ''}`}
              onClick={() => {
                storylineFilterStore.setSelectedStorylineId(storyline.id);
                setShowStorylineMenu(false);
              }}
            >
              {storyline.name}
              {storylineFilterStore.selectedStorylineId() === storyline.id && <BsCheck />}
            </button>
          )}
        </For>
      </div>
    </Show>
  </div>
</Show>
```

Add click-outside handler (similar to viewModeMenu, around line 113).

### 6. Add Highlighting to StoryNavigation
**File:** `src/components/StoryNavigation.tsx`

Import the store:
```typescript
import { storylineFilterStore } from '../stores/storylineFilterStore';
```

Add memo to check if chapter matches filter (in NodeItem component, around line 196):
```typescript
const matchesStorylineFilter = () => {
  const selectedId = storylineFilterStore.selectedStorylineId();
  if (!selectedId) return false; // No filter active

  const n = node();
  if (!n || n.type !== 'chapter') return false;

  return (n.activeContextItemIds || []).includes(selectedId);
};
```

Update the title rendering (around line 988-997) to apply blue color:
```typescript
<span
  class={styles.nodeTitle}
  style={{
    color: matchesStorylineFilter()
      ? "var(--primary-color)" // Blue highlight
      : getStatusColor()
  }}
  title={`ID: ${props.treeNode.id}`}
>
  {node()?.title}{" "}
  <span style={{ opacity: 0.5, "font-size": "0.8em" }}>
    ({props.treeNode.id.slice(0, 8)})
  </span>
</span>
```

## Testing Checklist

- [ ] Can create context items with type "plot"
- [ ] Can edit existing context items to change type to "plot"
- [ ] Storyline picker appears in NodeHeader for chapters
- [ ] Can assign multiple storylines to a chapter
- [ ] ChapterContextManager doesn't show plot-type items
- [ ] ChapterContextManager preserves plot assignments when saving
- [ ] Storyline picker preserves non-plot context items when saving
- [ ] Storyline filter dropdown appears in StoryHeader
- [ ] Selecting a storyline highlights matching chapters in blue
- [ ] Selecting "All Chapters" removes highlighting
- [ ] Highlight works alongside existing branch fading
- [ ] Active storylines show in NodeHeader metadata
- [ ] Filter resets on page reload (no persistence)

## Edge Cases

1. **No storylines defined:** Picker shows empty state with helpful message
2. **Chapter with no storylines:** Not highlighted when any filter active
3. **Deleting a storyline:** Chapters lose that assignment (handled by context item deletion)
4. **Multiple chapters same storyline:** All highlighted when that storyline selected
5. **Status color vs highlight:** Storyline highlight takes precedence over status color
6. **Branch fading interaction:** Faded branches stay faded, highlighted chapters within active branch show blue

## Future Enhancements (Not in Scope)

- Summary view showing storyline distribution
- Visual indicators (badges) on chapters showing storyline count
- Multi-select filter (highlight multiple storylines with different colors)
- Persistence of selected filter across sessions
- Storyline-specific analytics (gaps, coverage)

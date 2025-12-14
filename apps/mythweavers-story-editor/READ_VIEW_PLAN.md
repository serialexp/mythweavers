# Read View Implementation Plan

## Overview
Add a new "Read" view mode that displays story content in a paginated, book-like format for comfortable reading.

## Message Schema Understanding

### Message Types
- All messages have `role: 'assistant'` (no user/system roles)
- `type` field can be:
  - `null` or undefined = normal story content
  - `'event'` = script-generated events (should be excluded)
  - `'chapter'` = chapter markers (legacy, should be excluded)
- `isQuery: true` = Q&A messages (not story content, should be excluded)
- `instruction` field = user's prompt (should be hidden in read view)
- Messages belong to chapters via `nodeId` or `chapterId`

### Content Filtering for Read View
```typescript
const getReadableContent = () => {
  return displayMessages().filter(msg =>
    msg.role === 'assistant' &&
    !msg.isQuery &&              // Exclude Q&A
    msg.type !== 'event' &&      // Exclude script events
    msg.type !== 'chapter'       // Exclude chapter markers
  )
}
```

## Implementation Architecture

### 1. Update ViewMode Store
**File**: `src/stores/viewModeStore.ts`
```typescript
export type ViewMode = 'normal' | 'reorder' | 'script' | 'read';
// Add isReadMode() helper
```

### 2. Create ReadModeView Component
**File**: `src/components/ReadModeView.tsx`

```typescript
interface Page {
  paragraphs: string[]      // Array of paragraph strings
  startIndex: number        // Index of first paragraph in full array
  endIndex: number         // Index of last paragraph in full array
}

interface ReadModeViewProps {
  isGenerating: boolean
}

// Main component structure:
1. Filter messages (story content only)
2. Extract all paragraphs from content
3. Calculate pages based on container dimensions
4. Render current page with typography
5. Navigation controls (prev/next/page counter)
```

### 3. Pagination Algorithm
```typescript
const calculatePages = createMemo(() => {
  const containerRef = // ref to reading container
  const messages = getReadableContent()

  // Extract all paragraphs
  const allParagraphs = messages
    .map(msg => msg.content.split(/\n\n+/))
    .flat()
    .filter(p => p.trim())

  // Get container dimensions
  const containerHeight = containerRef?.clientHeight || 600

  // Create hidden measuring div
  const measurer = document.createElement('div')
  // Apply same styles as reading container
  measurer.style.cssText = `
    position: absolute;
    visibility: hidden;
    width: ${containerRef?.clientWidth}px;
    font-family: Georgia, serif;
    font-size: 18px;
    line-height: 1.7;
  `
  document.body.appendChild(measurer)

  const pages: Page[] = []
  let currentPage: string[] = []
  let startIndex = 0

  allParagraphs.forEach((para, index) => {
    // Add paragraph to measurer
    const paraElement = document.createElement('p')
    paraElement.textContent = para
    measurer.appendChild(paraElement)

    // Check if exceeds container height
    if (measurer.offsetHeight > containerHeight && currentPage.length > 0) {
      // Save current page (without the paragraph that caused overflow)
      pages.push({
        paragraphs: [...currentPage],
        startIndex,
        endIndex: index - 1
      })

      // Start new page
      measurer.innerHTML = ''
      measurer.appendChild(paraElement)
      currentPage = [para]
      startIndex = index
    } else {
      currentPage.push(para)
    }
  })

  // Add remaining paragraphs as last page
  if (currentPage.length > 0) {
    pages.push({
      paragraphs: currentPage,
      startIndex,
      endIndex: allParagraphs.length - 1
    })
  }

  // Cleanup
  document.body.removeChild(measurer)

  return pages
})
```

### 4. Create Styles
**File**: `src/components/ReadModeView.module.css`

```css
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.readingArea {
  flex: 1;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: 18px;
  line-height: 1.7;
  color: var(--text-primary);
  overflow: hidden;
  position: relative;
}

.paragraph {
  margin-bottom: 1.5em;
  text-indent: 2em;
  text-align: justify;
}

.paragraph:first-child {
  text-indent: 0;
}

/* Optional: Drop cap for first paragraph */
.paragraph:first-child::first-letter {
  float: left;
  font-size: 3em;
  line-height: 0.8;
  margin: 0.1em 0.1em 0 0;
  font-weight: bold;
}

.navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.navButton {
  padding: 0.5rem 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.navButton:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.navButton:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pageCounter {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Click zones for navigation */
.prevZone, .nextZone {
  position: absolute;
  top: 0;
  bottom: 60px; /* Leave space for nav bar */
  width: 30%;
  cursor: pointer;
  z-index: 1;
}

.prevZone {
  left: 0;
}

.nextZone {
  right: 0;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .readingArea {
    padding: 1rem;
    font-size: 16px;
  }

  .paragraph {
    text-align: left; /* Better for mobile */
  }
}
```

### 5. Update MessageListItems
**File**: `src/components/MessageListItems.tsx`

Add the Read view case:
```typescript
<Match when={viewModeStore.isReadMode()}>
  <ReadModeView isGenerating={props.isGenerating} />
</Match>
```

### 6. Update StoryHeader Dropdown
**File**: `src/components/StoryHeader.tsx`

Add Read option to the view mode dropdown:
```typescript
<button
  class={`${styles.dropdownItem} ${viewModeStore.viewMode() === 'read' ? styles.activeMode : ''}`}
  onClick={() => {
    viewModeStore.setViewMode('read');
    setShowViewModeMenu(false);
  }}
>
  <BsBookHalf /> Read View
  {viewModeStore.viewMode() === 'read' && <BsCheck />}
</button>
```

## Features

### MVP Features
1. **Content Processing**
   - Filter to story messages only (no queries, events, instructions)
   - Combine sequential messages
   - Split into paragraphs at double newlines

2. **Pagination**
   - Calculate page breaks at paragraph boundaries
   - Memoized page calculation
   - Recalculate on resize or content change

3. **Navigation**
   - Previous/Next buttons
   - Page counter ("Page 3 of 25")
   - Keyboard shortcuts (arrow keys)
   - Click zones (left 30% = prev, right 30% = next)

4. **Typography**
   - Serif font (Georgia or Crimson Pro)
   - Optimal line height (1.7)
   - Max width for comfortable reading
   - Responsive font sizing

### Future Enhancements (Post-MVP)
- Font size adjustment buttons
- Dark/light theme toggle
- Reading progress saved to localStorage
- Export to PDF/ePub
- Swipe gestures on mobile
- Reading time estimate
- Bookmarks

## Implementation Order

1. ✅ Research message types and filtering
2. Add 'read' mode to ViewMode type and store
3. Create ReadModeView component with basic structure
4. Implement pagination logic with memoization
5. Add navigation controls
6. Style for beautiful reading experience
7. Wire up to MessageListItems
8. Add to StoryHeader dropdown
9. Test on various screen sizes
10. Add keyboard navigation

## Notes

- Single chapter at a time (uses existing chapter filtering)
- No extra navigation sidebar (leverages existing StoryNavigation)
- Read-only mode (no editing in this view)
- Clean reading experience with hideable header
- Pagination recalculates on viewport resize
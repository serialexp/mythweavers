# Current Task Progress - Instance 2

## Session Summary (2025-12-19)

### Completed Work

#### 1. Routing Restructure for MythWeavers Apps

Combined the writer landing page with the story list:

**Story Editor (`mythweavers-story-editor`):**
- `/` now shows StoryLandingPage (story list) instead of marketing page
- `/stories` kept as legacy route (same as `/`)
- Removed `/marketing` route entirely
- Deleted `AboutPage.tsx` and `AboutPage.css.ts`

**Reader Frontend (`mythweavers-reading-frontend`):**
- Home page (`/`) now includes marketing content:
  - Hero section with "MythWeavers" title and tagline
  - Description paragraph
  - "Start Writing" and "Browse Stories" CTA buttons
  - 6 key features in responsive grid
  - Recent stories section
- Added styles in `pages.css.ts` for hero, features, CTA sections

#### 2. Story Editor NavBar

Added consistent header to StoryLandingPage:
- MythWeavers logo and brand link
- Navigation links (Stories)
- User dropdown (username, Settings, Logout) when authenticated
- "Offline Mode" badge when in offline mode
- Theme toggle button (light/dark mode)
- Copied `mythweavers.png` to story editor public folder

#### 3. ThemeProvider Setup

Added ThemeProvider to story editor:
- Wrapped app in `ThemeProvider` in `main.tsx`
- Removed static `chronicleTheme` class that was conflicting with theme toggle
- Theme toggle now works correctly

#### 4. New UI Components (`@mythweavers/ui`)

**Heading Component:**
- `level` prop (1-6) for semantic h1-h6 tags
- `size` prop (xs, sm, base, lg, xl, 2xl, 3xl, 4xl)
- `weight`, `color`, `align` props
- `as` prop to render as different element

**Text Component:**
- `size` prop (xs, sm, base, lg, xl)
- `weight`, `color`, `align` props
- `as` prop (defaults to `p`)

#### 5. Vanilla Extract CSS Migrations

Converted inline CSS variables to proper vanilla-extract styles:

**NewStoryForm.css.ts:**
- Storage option styles (container, option, disabled state)
- Radio button, icon, title, description styles
- Field label and button row styles
- Storage options now display side-by-side (flex row)
- Removed calendar selection (defaults to 'simple365')

**StoryLandingPage.css.ts:**
- Page wrapper with `tokens.color.bg.base` background
- Content area with flex layout

**StoryNavigation.css.ts:**
- Action button styles with proper theme colors
- Expand button styles
- Dropdown menu and button styles
- Delete button (semantic error color)
- Node controls container (holds both indicators and actions)
- Node indicators (always visible)
- Node actions (visible on hover via globalStyle)

**StoryHeader.css.ts:**
- Header toggle button positioning (fixed top-right)

#### 6. Bug Fixes

**Node Delete Error:**
- Fixed `saveService.ts` - delete operations now pass `data: node` so the node type is available when calling the correct delete API endpoint

**Story Input Scene Support:**
- Updated `StoryInput.tsx` to allow generation when a scene is selected (not just chapters)
- Renamed `isChapterSelected` to `isWritableNodeSelected`
- Updated placeholder text: "Select a chapter or scene first..."

#### 7. Component Cleanup

**Removed:**
- `StorageMigrationBanner.tsx` - Not relevant for new MythWeavers product
- "Create New Story" heading in StoryLandingPage (redundant with tab label)

**Updated:**
- Header toggle button now uses `IconButton` from @mythweavers/ui instead of custom button

#### 8. StoryNavigation Indicator/Actions Structure

Restructured node row controls:
- `nodeControls` - container for both indicators and actions
- `nodeIndicators` - always visible (script changes, branches, missing time, needs summary, include status, loading spinner)
- `nodeActions` - visible on parent hover (add child button, menu button)

Both share the same row with indicators always showing and actions fading in on hover.

#### 9. Dropdown Component Enhancement (`@mythweavers/ui`)

Fixed and enhanced the Dropdown component:
- Fixed click-outside handling using `createEffect` with proper cleanup
- Added `active` prop to `DropdownItem` for showing selected state with checkmark
- Added `portal` prop for rendering menu in a portal (escapes `overflow: hidden`)
- Removed unused variables (`_open`, `_triggerElement`, `menuRef`)
- Added CSS for `itemActive`, `itemLabel`, `checkmark` styles
- Updated story with "With Active State" and "Portal Mode" variants

#### 10. StoryHeader Dropdown Refactor

Refactored all dropdowns in StoryHeader to use the UI package Dropdown component:
- Removed ~60 lines of manual dropdown state management (signals, refs, effects)
- Removed ~50 lines of inline dropdown styles
- View Mode dropdown now uses `<Dropdown>` with `<DropdownItem active={...}>`
- Storyline Filter dropdown now uses `<Dropdown>` with dynamic items
- More Options menu now uses `<Dropdown>` with icons
- Removed `BsCheck` icon import (checkmarks handled by DropdownItem)

#### 11. StoryManager Refactor

Converted StoryManager to use UI components and vanilla-extract:
- Now uses `Modal` component from `@mythweavers/ui`
- Now uses `Button` component from `@mythweavers/ui`
- Created `StoryManager.css.ts` with proper theme tokens
- Simplified "Current Story" section to a compact bar:
  - Storage icon (☁️ or 💾) with tooltip
  - Story name
  - "Save As..." button
- Removed Save button (everything auto-saves)
- Removed server status indicator (redundant)
- Removed unused `handleSave` function
- Added padding to stories section to prevent hover clipping

### Current State

- **TypeScript:** Pre-existing errors only in CalendarEditor.tsx (3 spread argument errors) and unused variables in UI package
- **Build status:** All packages build successfully
- **Theme:** Properly toggles between chronicle (dark) and starlight (light)

### Files Modified This Session

**Story Editor:**
- `src/App.tsx` - Removed AboutPage import and /marketing route
- `src/main.tsx` - Added ThemeProvider, removed static theme class
- `src/components/StoryLandingPage.tsx` - NavBar, CSS classes, removed header
- `src/components/StoryLandingPage.css.ts` - NEW
- `src/components/NewStoryForm.tsx` - CSS classes, removed calendar
- `src/components/NewStoryForm.css.ts` - NEW
- `src/components/StoryNavigation.tsx` - CSS classes, restructured controls
- `src/components/StoryNavigation.css.ts` - NEW
- `src/components/StoryHeader.tsx` - Refactored to use Dropdown component, removed manual dropdown handling
- `src/components/StoryHeader.css.ts` - NEW
- `src/components/StoryInput.tsx` - Scene support for generation
- `src/components/StoryManager.tsx` - Refactored to use Modal/Button, simplified current story bar
- `src/components/StoryManager.css.ts` - NEW
- `src/services/saveService.ts` - Fixed node delete bug
- `src/pages/AboutPage.tsx` - DELETED
- `src/pages/AboutPage.css.ts` - DELETED
- `src/components/StorageMigrationBanner.tsx` - DELETED
- `public/mythweavers.png` - NEW (copied from reader)

**Reader Frontend:**
- `src/routes/index.tsx` - Marketing content, hero, features
- `src/styles/pages.css.ts` - Hero, feature grid, CTA styles

**UI Package:**
- `src/components/Heading/` - NEW component
- `src/components/Text/` - NEW component
- `src/components/Tabs/Tabs.tsx` - Added style prop support
- `src/components/Dropdown/Dropdown.tsx` - Fixed click-outside, added active/portal support
- `src/components/Dropdown/Dropdown.css.ts` - Added itemActive, itemLabel, checkmark styles
- `src/components/Dropdown/Dropdown.story.tsx` - Added active state and portal variants
- `src/components/index.ts` - Exports for new components

### Known Issues

1. **CalendarEditor.tsx** - 3 TypeScript errors (spread argument type issues) - pre-existing
2. **UI Package unused variables** - Several `_prefixed` unused variables in Modal, IconButton, Toast, Editor - pre-existing
3. **CSS variables in inline styles** - Some components still use `var(--...)` which doesn't work with vanilla-extract themes. Should be migrated to CSS files or theme tokens.

---

## Session Summary (2025-12-19 - Continued)

### Completed Work

#### 12. Mobile Sidebar Navigation Fix

Fixed sidebar toggle not working on mobile:

**Problem:** The sidebar was permanently open on mobile and the toggle button wasn't working properly.

**Solution - Separated desktop and mobile navigation:**
- **Desktop:** Sidebar visibility tied to `headerStore.isCollapsed()` - when header is collapsed, sidebar hides
- **Mobile:** Sidebar is an overlay controlled independently by `navigationStore.showNavigation`
- Mobile sidebar slides in from left as an overlay (85vw width, max 400px)
- Backdrop closes sidebar when tapped
- Auto-closes when selecting a scene

**Files changed:**
- `src/stores/headerStore.ts` - Changed toggle to use updater function pattern
- `src/App.tsx` - Added `isMobile` signal with resize handler, separate Show conditions for desktop/mobile navigation, added mobile navigation styles
- `src/App.css` - Added `@keyframes slideInFromLeft` animation

#### 13. Navigation Button Styling (StoryHeader)

Converted the mobile navigation button (BsBookHalf) to vanilla-extract with theme tokens:

**StoryHeader.css.ts additions:**
- `navigationButton` - Large prominent button with `tokens.color.accent.primary`, 56px min-width, 24px font size
- `navigationButtonActive` - Hover state with `tokens.color.accent.primaryHover` and inner shadow

The button is intentionally larger and more prominent than other header buttons since it's a primary mobile action.

#### 14. Header Toggle Button Positioning

Updated `headerToggle` style to position 5px from top and right (centers in header bar).

#### 15. Mobile Node Actions Visibility

Made node actions (add child, menu buttons) always visible on mobile:

**StoryNavigation.css.ts:**
- Added `@media (max-width: 768px)` to `nodeActions` style with `opacity: 1`
- Desktop: Actions fade in on hover
- Mobile: Actions always visible (touch devices need visible targets)

#### 16. Insert Node Label Fix

Fixed "Insert Chapter Before" showing for scenes - now correctly shows:
- "Insert Book Before" for books
- "Insert Arc Before" for arcs
- "Insert Chapter Before" for chapters
- "Insert Scene Before" for scenes

**StoryNavigation.tsx:** Updated ternary to handle all node types.

#### 17. NodeStatusMenu Vanilla Extract Migration

Converted NodeStatusMenu from inline styles to vanilla-extract with theme tokens:

**NodeStatusMenu.css.ts (NEW):**
- `container` - Relative positioning
- `triggerButton` / `triggerButtonOpen` - Theme-aware button styles with hover states
- `triggerContent` - Flex container for icon and label
- `chevron` / `chevronOpen` - Rotation animation
- `dropdown` - Elevated background, borders, shadows
- `optionButton` / `optionButtonSelected` - Option styles with hover and selected states
- `statusIndicator` / `statusIndicatorEmpty` - Status dot styles

**NodeStatusMenu.tsx:**
- Replaced all inline styles with CSS classes
- Added `BsFlag` icon to trigger button for consistency with other menu items

### Files Modified This Session (Continued)

**Story Editor:**
- `src/stores/headerStore.ts` - Updater function pattern for toggle
- `src/stores/navigationStore.ts` - (existing, now properly used on mobile)
- `src/App.tsx` - Mobile detection, separate desktop/mobile navigation rendering
- `src/App.css` - slideInFromLeft animation
- `src/components/StoryHeader.tsx` - Navigation button uses vanilla-extract styles
- `src/components/StoryHeader.css.ts` - Added navigationButton styles, updated headerToggle position
- `src/components/StoryNavigation.tsx` - Fixed insert node labels
- `src/components/StoryNavigation.css.ts` - Mobile visibility for nodeActions
- `src/components/NodeStatusMenu.tsx` - Full vanilla-extract migration, added BsFlag icon
- `src/components/NodeStatusMenu.css.ts` - NEW

### Current State

- **TypeScript:** Pre-existing errors only (CalendarEditor.tsx, UI package unused variables)
- **Build status:** All packages build successfully
- **Mobile UX:**
  - Header toggle controls all chrome (header + sidebar on desktop)
  - Navigation button in header controls sidebar independently on mobile
  - Sidebar appears as slide-in overlay on mobile
  - Node actions always visible on mobile

---

## Session Summary (2025-12-19 - Continued #2)

### Completed Work

#### 18. UI Tweaks - Story Settings & Header Cleanup

**Moved Story Settings to More Options Menu:**
- Removed standalone gear icon button from header
- Added "Story Settings" as first item in the "More Options" dropdown

**Removed Duplicate Headers from Characters and Context Items:**
- Both overlay panels had duplicate titles (once in modal header, once inside the sidebar)
- Added `headerAction` prop to OverlayPanel component for placing buttons in the header
- Removed internal headers from Characters and ContextItems
- Added `CharactersRef` and `ContextItemsRef` interfaces to expose `addNew()` method
- StoryHeader now passes "Add" button as `headerAction` to both panels

#### 19. Tabs Component Improvements

**Responsive Tabs for Narrow Containers:**
- Added `overflow-x: auto` to tab list
- Made tabs use `font.size.xs` (12px) with compact padding
- Added `flex: 1` so tabs share space equally

**Line-Break Layout for Context Items Tabs:**
- Changed tabs to show label and count on separate lines using `<br/>`
- Example: "Storylines" on line 1, "(1)" on line 2
- Keeps 4 tabs visible in the 300px sidebar

**Toggleable Tabs Feature:**
- Added `toggleable` prop to Tabs component
- When enabled, clicking an active tab deselects it (sets activeTab to '')
- Used for script help tabs that should be collapsible

#### 20. ListDetailPanel Component (`@mythweavers/ui`)

Created a reusable master-detail layout component:

**Features:**
- Flexbox layout with 280px fixed sidebar and flexible detail area
- Desktop: Both columns always visible
- Mobile (<768px): List/detail swap visibility
- Back button only shown on mobile
- Empty state message when nothing selected
- Support for "new item" form mode

**Props:**
- `items` - Array of items with `id` field
- `listHeader` - Optional content above list (tabs, filters)
- `renderListItem` - Render function for list items
- `renderDetail` - Render function for detail view
- `renderNewForm` - Render function for "add new" form
- `detailTitle` - Title function for detail header
- `newItemTitle` - Title for new item form
- `backIcon` - Custom back button icon
- `emptyStateMessage` - Message when nothing selected
- `onSelectionChange` - Selection change callback

**Ref Methods:**
- `select(id)` - Select item or 'new'
- `clearSelection()` - Return to list
- `selectedId()` - Get current selection

#### 21. Characters & ContextItems Refactored to ListDetailPanel

Both components now use the shared ListDetailPanel:

**ContextItems:**
- Removed ~100 lines of container/layout styles
- Tabs passed via `listHeader` prop
- List items, detail view, and new form as render props
- Compact detail view: Type and Global in single row, Description below
- Delete and Edit buttons moved to detail header
- Removed redundant "Context Item Details" title (name shown instead)

**Characters:**
- Removed ~150 lines of container/layout styles
- Character avatar and name as list item content
- Detail view with portrait, description, birthdate, actions
- New form with image upload, description editor, birthdate picker

#### 22. ScriptHelpTabs Component

Combined EJSDocumentation and AvailableFunctions into a single tabbed component:

- Uses `Tabs` with `toggleable` prop (starts with no selection)
- "EJS Script Help" tab - collapsible sections for Basics, Variables, Functions, Examples
- "Functions" tab - Shows available functions from Global Script with badge count
- Replaces separate button+card patterns in Characters and ContextItems

#### 23. View Mode Dropdown Layout Fix

Fixed dropdown arrow falling outside button space:
- Changed layout from horizontal (icon + arrow) to vertical (icon above arrow)
- Icon and `BsChevronDown` now stacked with flex column
- Applied to both View Mode and Storyline Filter dropdowns

#### 24. Vanilla-Extract Migration Progress

**NodeHeader.tsx - COMPLETED (82 references):**
- Created `NodeHeader.css.ts` with all styles using theme tokens
- Converted all inline styles to class-based approach
- Includes: header, title, metadata, actions, dropdown, viewpoint selector, summary, goal sections
- Added keyframes for spinner animation

**InsertControls.tsx - COMPLETED:**
- Created `InsertControls.css.ts`
- Replaced JS event handlers (onMouseEnter/onMouseLeave) with CSS `:hover` pseudo-class
- Cleaner approach for opacity transition on hover

### Files Modified This Session

**UI Package (`@mythweavers/ui`):**
- `src/components/Tabs/Tabs.tsx` - Added `toggleable` prop
- `src/components/Tabs/Tabs.css.ts` - Compact sizing, responsive padding
- `src/components/ListDetailPanel/` - NEW directory
  - `ListDetailPanel.tsx` - Main component
  - `ListDetailPanel.css.ts` - Responsive styles
  - `index.ts` - Exports
- `src/components/index.ts` - Added ListDetailPanel export
- `src/components/OverlayPanel/OverlayPanel.tsx` - Added `headerAction` prop

**Story Editor (`mythweavers-story-editor`):**
- `src/components/StoryHeader.tsx` - Settings moved to menu, dropdown layout fixes
- `src/components/Characters.tsx` - Refactored to use ListDetailPanel
- `src/components/ContextItems.tsx` - Refactored to use ListDetailPanel, compact detail view
- `src/components/ScriptHelpTabs.tsx` - NEW (combined EJS docs and available functions)
- `src/components/NodeHeader.tsx` - Full vanilla-extract migration
- `src/components/NodeHeader.css.ts` - NEW
- `src/components/InsertControls.tsx` - Vanilla-extract migration
- `src/components/InsertControls.css.ts` - NEW

### Remaining var(--) Migration Work

**Files with most remaining references:**
- Message.tsx (45 refs)
- StoryNavigation.tsx (28 refs)
- RefinementPreview.tsx (24 refs)
- MessageVersionHistory.tsx (24 refs)
- Characters.tsx (24 refs) - Note: Still has inline styles for list items
- Plus ~20 other files with fewer references

**Total remaining:** ~573 references across the codebase

### Current State

- **TypeScript:** Pre-existing errors only (CalendarEditor.tsx, UI package unused variables)
- **Build status:** All packages build successfully
- **Theme:** Properly toggles between chronicle (dark) and starlight (light)

### Next Steps

1. Continue vanilla-extract migration for remaining files (StoryNavigation.tsx, RefinementPreview.tsx, MessageVersionHistory.tsx next)
2. Fix CalendarEditor TypeScript errors
3. Clean up unused variables in UI package

---

## Session Summary (2025-12-19 - Continued #3)

### Completed Work

#### 25. Message.tsx Vanilla-Extract Migration (45 references)

Fully migrated Message.tsx from inline CSS variable styles to vanilla-extract:

**Message.css.ts (NEW):**
- `message` - Base message container with position, padding, background, border-radius, transitions
- `messageAssistant`, `messageInstruction`, `messageQuery` - Role-specific styling
- `messageSummarizing`, `messageAnalyzing`, `messageEvent`, `messageCut`, `messageInactive` - State variants
- `content`, `contentEditable` - Content area styles
- `actions`, `actionButtons`, `actionButton` - Actions bar and button base
- `editButton`, `saveButton`, `cancelButton`, `deleteButton`, `targetButton`, `scriptButton` - Button variants
- `timestamp`, `tokenInfo`, `cacheHit` - Info display styles
- `summary`, `summaryHeader`, `summaryTitle`, `summaryTabs`, `summaryTab`, `summaryTabActive`, `summaryContent`, `summaryToggle` - Summary section
- `eventIcon` - Event icon styling
- `thinkSection`, `thinkTitle`, `thinkToggle` - Think section styles
- `scriptModeSection`, `scriptCode` - Script mode display
- `pasteContainer`, `pasteButton` - Cut/paste controls
- `draftSaved`, `orderHighlight` - Additional utility styles

**Message.tsx changes:**
- Added `cn()` helper function for class name composition
- Replaced `getMessageStyle()` with `getMessageClasses()` returning class string
- Converted all `style={msgStyles.xxx}` to `class={styles.xxx}` or `class={cn(...)}`
- Removed entire `msgStyles` object (~260 lines)
- Added `import * as styles from './Message.css'`

#### 26. Badge Component Style Prop

Added `style` prop to Badge component (`@mythweavers/ui`) to support inline styles where needed.

### Files Modified This Session

**Story Editor (`mythweavers-story-editor`):**
- `src/components/Message.tsx` - Full vanilla-extract migration
- `src/components/Message.css.ts` - NEW

**UI Package (`@mythweavers/ui`):**
- `src/components/Badge/Badge.tsx` - Added style prop

### Remaining var(--) Migration Work

**Files with most remaining references:**
- StoryNavigation.tsx (28 refs)
- RefinementPreview.tsx (24 refs)
- MessageVersionHistory.tsx (24 refs)
- Characters.tsx (24 refs) - Note: Still has inline styles for list items
- Plus ~20 other files with fewer references

**Total remaining:** ~528 references across the codebase (down from 573)

### Current State

- **TypeScript:** Pre-existing errors only (CalendarEditor.tsx 3 errors, UI package 5 unused variable warnings)
- **Build status:** All packages build successfully
- **Theme:** Properly toggles between chronicle (dark) and starlight (light)

---

**Notes:** Kept all 9 rules in mind during this session. The migration from inline CSS variable styles to vanilla-extract CSS is making good progress - Message.tsx was one of the largest files with 45 references.

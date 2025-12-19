# Current Task: Astro Reading Frontend Migration

## Status: COMPLETED (Dec 18, 2025)

### Background

The SolidStart/Vinxi-based reading frontend (`apps/mythweavers-reading-frontend`) had severe performance issues:

1. **Navigation freezes** - Client-side navigation would freeze the browser for 10+ seconds
2. **SSR slowness** - SSR took seconds even though API calls were fast (~200ms)
3. **Seroval streaming issues** - The `seroval` library used for SSR serialization creates thousands of inline functions per async boundary, overwhelming browsers (especially Firefox)
4. **Tab crashes** - Disabling SSR caused the tab to crash entirely

Root cause: SolidStart's streaming SSR uses `seroval` which generates massive JavaScript payloads with inline functions for each Promise/stream. This is a fundamental architectural issue with seroval, not something we can fix.

### Solution: Astro with SolidJS

Created a new Astro-based frontend at `apps/mythweavers-reading-frontend-astro/`:

- **Astro** for server rendering and routing (fast, mature, battle-tested SSR)
- **SolidJS** for interactive components via `@astrojs/solid-js` integration
- **Vanilla Extract** for CSS (same as before)
- **UI components** from `@mythweavers/ui` package

### Files Created

```
apps/mythweavers-reading-frontend-astro/
├── package.json                 # Astro + SolidJS + vanilla-extract deps
├── astro.config.mjs             # Astro config with Node adapter, SolidJS, vanilla-extract
├── tsconfig.json                # TypeScript config
├── public/                      # Copied from old frontend (images, favicon, etc.)
├── src/
│   ├── components/
│   │   ├── Layout.tsx           # SolidJS - wraps ThemeProvider, NavBar, UserStatus
│   │   ├── Layout.css.ts        # Copied from old frontend
│   │   ├── UserStatus.tsx       # SolidJS - login/register or user dropdown
│   │   ├── StoryCard.tsx        # SolidJS - story card component
│   │   └── StoryCard.css.ts     # Copied from old frontend
│   ├── lib/
│   │   └── api.ts               # API client (REST)
│   ├── pages/
│   │   ├── index.astro          # Home page - fetches stories, renders in Layout
│   │   ├── stories.astro        # Stories listing page
│   │   ├── login.astro          # Login page with error handling
│   │   ├── register.astro       # Register page with error handling
│   │   ├── bookshelf.astro      # Protected bookshelf page
│   │   ├── story/
│   │   │   ├── [storyId].astro  # Story detail page
│   │   │   └── [storyId]/
│   │   │       └── chapter/
│   │   │           └── [chapterId].astro  # Chapter reading page
│   │   └── api/
│   │       └── auth/
│   │           ├── login.ts     # POST handler for login
│   │           ├── register.ts  # POST handler for registration
│   │           └── logout.ts    # POST handler for logout
│   └── styles/
│       ├── global.css           # Global styles (imports @mythweavers/ui/styles)
│       ├── pages.css.ts         # Page layout styles
│       └── story.css.ts         # Story/chapter page styles
```

### Key Architecture Decisions

1. **Astro pages (`.astro`)** handle:
   - Server-side data fetching (in frontmatter `---` section)
   - HTML structure and head tags
   - Reading theme cookie and applying theme class to `<html>`
   - Reading user session cookie and passing to Layout

2. **SolidJS components (`.tsx`)** handle:
   - Interactive UI (theme toggle, dropdowns, forms)
   - Used with `client:load` directive for hydration

3. **Theme handling (SSR-compatible)**:
   - Astro reads `writer-ui-theme` cookie in each page
   - Imports theme classes from `@mythweavers/ui/theme`
   - Applies theme class directly to `<html>` element in SSR output
   - Passes `initialTheme` prop to Layout for ThemeProvider hydration
   - No flash of unstyled content on page load

4. **Authentication**:
   - User session stored in `user-session` httpOnly cookie (JSON)
   - API endpoints at `/api/auth/*` handle login/register/logout
   - Pages read cookie and pass user to Layout
   - Protected pages (bookshelf) redirect to login if not authenticated

### How to Run

```bash
cd apps/mythweavers-reading-frontend-astro
pnpm dev
```

Server starts on port 3333.

### What Works

- Home page with story grid
- Stories listing page with filtering
- Story detail page with chapter list
- Chapter reading page with navigation
- Theme switching (persisted in cookie, SSR-compatible)
- Login/Register forms with error handling
- User session management
- Bookshelf page (protected route)
- Logout functionality

### Remaining Work (Future)

- Add actual bookshelf/library functionality (save stories to library)
- Add "Add to Library" button functionality on story pages
- Add reading progress tracking
- Add search functionality
- Style polish and responsive design improvements

---

## Story Editor UI Cleanup (Dec 19, 2025)

### Settings Component Refactor

Refactored Settings to use `ListDetailPanel` with section-based navigation. Removed the "Context & Generation" section entirely (smart context and cache keep-alive are no longer needed).

### Remaining Cleanup

The following props are now **unused** in `Settings.tsx` and should be removed from:
1. `SettingsProps` interface in `Settings.tsx`
2. The parent component (`StoryHeader.tsx`) that passes these props
3. `settingsStore` if the values are no longer needed anywhere

**Props to remove:**
- `useSmartContext` / `setUseSmartContext`
- `autoGenerate` / `setAutoGenerate`

---

## Context

The reading frontend is part of the MythWeavers monorepo, which includes:
- `apps/mythweavers-story-editor` - The story writing/editing application
- `apps/mythweavers-reading-frontend` - Original SolidStart reader (deprecated due to performance issues)
- `apps/mythweavers-reading-frontend-astro` - New Astro-based reader (current)
- `packages/ui` - Shared UI component library (SolidJS + Vanilla Extract)
- `packages/solid-editor` - Custom rich text editor

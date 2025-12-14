# Multi-Calendar System - Session Summary

**Date:** December 2-3, 2025
**Status:** Phase 0, 1, 2, 3, 4, 5 & Bonus Complete ✅

## What We Accomplished

### Phase 0: Test-Driven Development ✅
- Set up **vitest** testing framework in `shared/` package
- Created **50 comprehensive tests** covering:
  - Basic time conversions (epoch, positive/negative years, BBY/ABY)
  - Round-trip conversion (storyTime → date → storyTime)
  - Subdivision calculations (quarters, weeks, months, days of week)
  - Format template system with all placeholders
  - Edge cases (year boundaries, very large years)
  - Nested subdivisions (up to 3 levels deep)
  - Multiple calendar systems
- **All tests passing: 50/50** ✅

### Phase 1: Core Calendar Engine ✅
- **CalendarEngine** class (389 lines) with full implementation:
  - `storyTimeToDate()` / `dateToStoryTime()` - bidirectional conversion
  - Hierarchical subdivisions (unlimited nesting depth)
  - Smart format template system with conflict detection
  - Arithmetic operations (add minutes/hours/days)
  - Rounding operations (round to hour, start of day/year)
- **Type definitions** (87 lines):
  - `CalendarConfig` - JSON-serializable configuration
  - `CalendarSubdivision` - hierarchical time units
  - `ParsedDate` - parsed calendar date with subdivisions
  - `StoryTime` - minutes from epoch 0
- **Calendar presets** (142 lines):
  - **Coruscant Standard Calendar** (Star Wars)
    - 368 days/year, 4 quarters, BBY/ABY eras
    - Festival days, season names
  - **Simple 365-Day Calendar**
    - 365 days/year, no subdivisions, BE/AE eras
    - Perfect for most fiction stories

### Key Technical Achievement
**Fixed critical naming conflict bug:** When processing "week" subdivisions, the engine was creating a `{dayOfWeek}` placeholder for "day within week" calculations, which conflicted with an actual subdivision named "dayOfWeek". Implemented smart conflict detection to prevent subdivision name collisions.

## Files Created

```
shared/
├── src/
│   ├── calendars/
│   │   ├── types.ts              (87 lines)  - Type definitions
│   │   ├── engine.ts             (389 lines) - CalendarEngine implementation
│   │   ├── engine.test.ts        (398 lines) - 30 core tests
│   │   ├── subdivisions.test.ts  (330 lines) - 20 nested tests
│   │   └── presets.ts            (142 lines) - Calendar presets
│   └── index.ts                  (updated)   - Exports
├── vitest.config.ts              (new)       - Test config
└── package.json                  (updated)   - Test scripts
```

## Design Highlights

### Universal Time Storage
- All times stored as `StoryTime` (minutes from epoch 0)
- Calendar-agnostic, works for any story universe
- Simple arithmetic, perfect round-trip conversion

### Multiple Calendars per Story
- Each story can have multiple calendars (e.g., different planets)
- One calendar designated as default for UI display
- Store calendars as JSON in database (fully flexible)

### Hierarchical Subdivisions
- Unlimited nesting: Year → Months → Weeks → Days of Week
- Fixed-size units (weeks = 7 days)
- Variable-size units (months with different lengths)
- Labels, labelFormats, and special days

### Format Templates
Dynamic placeholder replacement:
- `{year}`, `{era}` - Year and era
- `{hour}`, `{minute}` - Time of day
- `{quarter}`, `{month}`, `{week}` - Subdivision labels
- `{quarterNumber}`, `{monthNumber}` - Numeric values
- `{dayOfQuarter}`, `{dayOfMonth}` - Day within subdivision
- `{dayLabel}` - Special day labels

### Phase 2: Database Migration ✅
1. ✅ Created `Calendar` model in Prisma schema
   - `id`, `storyId`, `config` (JSON), timestamps
   - Bidirectional relations with Story
2. ✅ Added `defaultCalendarId` to Story model
3. ✅ Created migration script (`src/migrations/add-calendars-to-stories.ts`)
   - Tested in dry-run mode first
   - Created Coruscant calendar for 30 existing stories
   - Set as default calendar for each story
4. ✅ Verified migration succeeded

### Phase 3: Backend Integration ✅
1. ✅ Created `calendarService.ts` with comprehensive API:
   - `getStoryDefaultCalendar(storyId)` - Get default calendar for a story
   - `getCalendar(calendarId)` - Get calendar by ID
   - `createCalendar(storyId, config)` - Create new calendar
   - `updateCalendar(calendarId, config)` - Update calendar configuration
   - `deleteCalendar(calendarId)` - Delete calendar
   - `getStoryCalendars(storyId)` - List all calendars for a story
   - `setStoryDefaultCalendar(storyId, calendarId)` - Set default calendar
   - `getOrCreateStoryDefaultCalendar(storyId)` - Get or create default
   - Engine caching for performance
2. ✅ Updated CLI to use CalendarEngine:
   - Replaced hardcoded `calculateStoryTimeDisplayDate()` with `formatStoryTimeWithCalendar()`
   - Updated `formatStoryTimeLabel()` to be async and use story's calendar
   - Modified `story:time-display` command to use CalendarEngine
   - Updated `nodes:read` to use story-specific calendar formatting
3. ✅ Removed duplicate calendar logic from CLI
4. ✅ Verified all changes with type checking and CLI tests

### Phase 4: Frontend Migration ✅
1. ✅ Created `calendarStore.ts`:
   - Reactive store that fetches story's default calendar
   - Auto-loads when story changes
   - Provides CalendarEngine instance
   - Helper methods: `formatStoryTime()`, `formatStoryTimeShort()`
   - Graceful fallback to Coruscant calendar on errors
2. ✅ Created backend API endpoint:
   - `GET /api/stories/:id/calendar` - Returns calendar config
   - Integrated into stories router
3. ✅ Replaced all `formatStoryTime()` calls:
   - NodeHeader.tsx - 2 replacements
   - Characters.tsx - 3 replacements
   - scriptDataStore.ts - 6 replacements
   - scriptEngine.ts - 3 replacements
   - MapTimeline.tsx - 4 replacements
   - MessageScriptModal.tsx - 3 replacements
4. ✅ Reviewed StoryTimePicker component:
   - Uses Coruscant-specific utilities (correct approach)
   - No changes needed - date picker is calendar-specific
5. ✅ Verified no remaining imports of `formatStoryTime` from old utilities
6. ✅ All TypeScript compilation passes

### Bonus: Calendar-Aware Age Calculations ✅
**Problem Identified:** Age calculations were hardcoded to Coruscant calendar (368 days/year)

**Solution Implemented:**
1. ✅ Added `calculateAge()` and `formatAge()` methods to CalendarEngine
   - Use calendar's `minutesPerYear` for accurate age calculations
   - Work with any calendar system (365-day, 368-day, custom, etc.)
2. ✅ Added wrapper methods to calendarStore for easy access
3. ✅ Updated scriptEngine to provide calendar-aware functions to EJS templates
   - Scripts now use story's calendar for age calculations
   - Backward compatible - same API, calendar-aware behavior

**Impact:** Character ages now respect the story's calendar system. A character born 10 years ago will be calculated correctly whether the story uses a 365-day or 368-day calendar.

### Phase 5: UI Enhancements ✅
1. ✅ **Backend API Endpoints** (5 new routes):
   - `GET /calendar-presets` - List available calendar presets
   - `POST /stories/:storyId/calendars` - Create new calendar for story
   - `PUT /calendars/:calendarId` - Update calendar configuration
   - `DELETE /calendars/:calendarId` - Delete calendar (with safety checks)
   - `PUT /stories/:storyId/default-calendar` - Set default calendar
   - All routes include proper validation and error handling

2. ✅ **Story Creation Integration**:
   - Added calendar preset selector to NewStoryForm
   - Dropdown shows all available presets with descriptions
   - Backend automatically creates calendar on story creation
   - Sets created calendar as story's default
   - Defaults to Simple365 if no preset specified

3. ✅ **Calendar Management UI**:
   - New `CalendarManagement` component (full CRUD interface)
   - Accessible from header's "More Menu" → "Calendar Management"
   - Opens as overlay panel (like Characters/Context Items)
   - Lists all calendars with details (days/year, hours/day)
   - Visual "Default" badge for default calendar
   - Add/Delete/Set Default operations
   - Prevents deletion of last calendar
   - Auto-refreshes calendarStore after changes

4. ✅ **Calendar Editor UI**:
   - New `CalendarEditor` component with form-based editing
   - No JSON editing required - all fields have dedicated inputs
   - **Basic Information**: ID, Name, Description
   - **Time Units**: Days/year, Hours/day, Minutes/hour
   - **Era Labels**: Positive/negative era names (CE/BCE, ABY/BBY, etc.)
   - **Subdivisions** (full support):
     - Add/remove subdivisions dynamically
     - Fields: ID, Name, Plural, Count
     - **Days per Unit**: Toggle between "Same for all" (fixed) or "Custom per unit" (array)
     - **Unit Labels**: Toggle between "Auto-numbered" (template) or "Custom names" (array)
     - Grid layouts for custom values (auto-adjusts to count)
     - Uses SolidJS stores for fine-grained reactivity (no focus loss)
   - Validation with clear error messages
   - Pre-fills from selected preset for easy customization

5. ✅ **StoryTimePicker Updates**:
   - Replaced hardcoded Coruscant calendar with dynamic calendar from calendarStore
   - Defaults to year 0 instead of -22 BBY
   - Shows correct era labels from calendar config (eras.positive/negative)
   - Uses calendar's max values for days, hours, minutes
   - Formats dates using calendar's engine
   - Handles previous chapter times with calendar-aware formatting
   - Works with any calendar system (Simple365, Coruscant, custom)

6. ✅ **Type System Updates**:
   - Added generic HTTP methods to ApiClient: `get()`, `post()`, `put()`, `delete()`
   - Extended `ApiStory` type to include `calendars[]` and `defaultCalendarId`
   - Added `Calendar` interface to API types
   - Updated `getStory` endpoint to include calendars in response

7. ✅ **UX Improvements**:
   - Removed slide-in animations from overlay panels for instant opening
   - Added padding to calendar items for better spacing
   - Clean, organized layout with proper visual hierarchy
   - Helpful hints and descriptions throughout
   - Responsive grid layouts for subdivision arrays
   - Fine-grained reactivity prevents input focus loss

**Result:** Users can now create, customize, and manage calendars entirely through the UI without touching JSON. The system supports the full complexity of the CalendarConfig schema while keeping the interface simple when you don't need advanced features.

## Testing Coverage

**50 tests across 2 test suites:**

### engine.test.ts (30 tests)
- Basic time conversion (4 tests)
- Round-trip conversion (1 test)
- Subdivision calculation (2 tests)
- Hour/minute calculation (3 tests)
- Format date (5 tests)
- Format story time (1 test)
- Arithmetic operations (4 tests)
- Rounding operations (3 tests)
- Edge cases (4 tests)
- Different calendar systems (2 tests)

### subdivisions.test.ts (20 tests)
- Quarter & week nesting (7 tests)
- Variable-length months (6 tests)
- Subdivision formatting (3 tests)
- Deep nesting (3 levels) (4 tests)

## Commands

```bash
# In shared/ directory
pnpm test          # Watch mode
pnpm test:run      # Single run
pnpm test:ui       # Visual UI
pnpm build         # Build package
```

## Documentation

- **CALENDAR_SYSTEM_DESIGN.md** - Complete architecture and design
- **CALENDAR_SESSION_SUMMARY.md** - This file
- All code fully documented with JSDoc comments

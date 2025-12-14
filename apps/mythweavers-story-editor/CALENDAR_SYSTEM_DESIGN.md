# Multi-Calendar System Design

## Implementation Status

**Current Phase:** Phase 4 Complete ✅ (+ Bonus: Calendar-Aware Age Calculations)
**Next Phase:** Phase 5 - UI Enhancements (Optional)

**Progress:**
- ✅ Phase 0: Test-Driven Development Setup (50/50 tests passing)
- ✅ Phase 1: Foundation (Shared Package) - CalendarEngine + Presets
- ✅ Phase 2: Database Migration (Prisma schema + migration)
- ✅ Phase 3: Backend Integration (Services + CLI)
- ✅ Phase 4: Frontend Migration (Replace old calendar code)
- ✅ Bonus: Calendar-Aware Age Calculations (calculateAge/formatAge)
- ⏳ Phase 5: UI Enhancements (Calendar management UI - optional)

**See CALENDAR_SESSION_SUMMARY.md for detailed implementation notes**

## Overview

This document describes the architecture for a flexible, JSON-based calendar system that allows each story to define its own timekeeping structure while maintaining a universal underlying time representation (minutes from epoch 0).

## Core Principles

1. **Universal Time Storage**: All times stored as `StoryTime` (minutes from epoch 0) - calendar-agnostic
2. **JSON-Based Configuration**: Calendar structures defined in JSON, stored per-story in database
3. **Hierarchical Subdivisions**: Support multiple levels (Year → Quarters → Weeks → Days, or Year → Months → Weeks → Days)
4. **Multiple Calendars per Story**: Each story can have multiple calendars (e.g., different planetary systems), with one designated as default
5. **User Customizable**: Users can edit calendar JSON or choose from presets
6. **Test-Driven Development**: Comprehensive tests written first, then implementation follows

## Current State Analysis

### What Works Well (Keep This)
- Universal time storage: Minutes from epoch (0) - calendar-agnostic ✓
- Consistent time tracking: All nodes, characters, events use same minute-based system ✓
- Timeline calculations: Adding/subtracting time is simple arithmetic ✓

### What's Hardcoded (Needs to be Flexible)
- Calendar conversion logic: Star Wars calendar (368-day years, BBY/ABY) hardcoded in:
  - `src/utils/coruscantCalendar.ts` (frontend)
  - `backend/src/cli/index.ts` (duplicate implementation!)
- Display formatting: All time displays assume Coruscant calendar structure
- UI components: StoryTimePicker hardcoded to Star Wars calendar
- 69+ references across codebase to Star Wars-specific calendar

## Architecture

### 1. Type Definitions

**File**: `shared/src/calendars/types.ts`

```typescript
export type StoryTime = number; // Minutes from epoch 0

/**
 * Hierarchical subdivision of a year
 * Examples:
 * - Year → Months → Weeks → Days
 * - Year → Quarters → Days
 * - Year → Seasons → Months → Days
 */
export interface CalendarSubdivision {
  id: string;                    // e.g., "month", "week", "quarter", "season"
  name: string;                  // e.g., "Month", "Week"
  pluralName: string;            // e.g., "Months", "Weeks"
  count: number;                 // How many of these in the parent unit
  daysPerUnit?: number[];        // Days in each unit (if variable, like months)
  daysPerUnitFixed?: number;     // Days in each unit (if fixed, like weeks)

  // Labels for each unit (optional)
  labels?: string[];             // e.g., ["January", "February", ...] for months
  labelFormat?: string;          // e.g., "Week {n}" if no explicit labels

  // Nested subdivisions (optional)
  subdivisions?: CalendarSubdivision[];
}

export interface CalendarConfig {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  description: string;           // User-friendly description

  // Time structure (required)
  minutesPerHour: number;
  hoursPerDay: number;
  minutesPerDay: number;         // Calculated: minutesPerHour * hoursPerDay
  daysPerYear: number;           // Total days in a year
  minutesPerYear: number;        // Calculated: minutesPerDay * daysPerYear

  // Year subdivisions (hierarchical)
  subdivisions: CalendarSubdivision[];

  // Era system
  eras: {
    positive: string;            // e.g., "ABY", "CE", "AD"
    negative: string;            // e.g., "BBY", "BCE", "BC"
    zeroLabel?: string | null;   // Optional: label for year 0 (or null if no year 0)
  };

  // Display configuration
  display: {
    defaultFormat: string;       // Template: e.g., "{day}, {month} (Q{quarter}), {year} {era} at {hour}:{minute}"
    shortFormat: string;         // e.g., "{month} {day}, {year} {era}"
    includeTimeByDefault: boolean;
    hourFormat: '12' | '24';     // 12-hour (AM/PM) or 24-hour
  };

  // Special days (optional)
  specialDays?: {
    [subdivisionId: string]: {   // e.g., "quarter"
      [dayNumber: number]: string; // e.g., 92: "Festival Day"
    };
  };
}

export interface ParsedDate {
  year: number;
  era: 'positive' | 'negative';
  dayOfYear: number;
  hour: number;
  minute: number;

  // Subdivision values (dynamic based on config)
  subdivisions: Map<string, number>; // e.g., "quarter" -> 2, "week" -> 5
}
```

### 2. Calendar Engine

**File**: `shared/src/calendars/engine.ts`

The `CalendarEngine` class handles all calendar conversions and formatting:

```typescript
export class CalendarEngine {
  constructor(public readonly config: CalendarConfig) {}

  // Core conversion methods
  storyTimeToDate(time: StoryTime): ParsedDate
  dateToStoryTime(date: ParsedDate): StoryTime

  // Formatting
  formatDate(date: ParsedDate, includeTime?: boolean): string
  formatStoryTime(time: StoryTime, includeTime?: boolean): string

  // Arithmetic helpers
  addMinutes(time: StoryTime, minutes: number): StoryTime
  addHours(time: StoryTime, hours: number): StoryTime
  addDays(time: StoryTime, days: number): StoryTime

  // Rounding/alignment
  roundToHour(time: StoryTime): StoryTime
  startOfDay(time: StoryTime): StoryTime
  startOfYear(time: StoryTime): StoryTime
}
```

**Key Implementation Details**:

1. **Subdivision Calculation**: Walks the subdivision tree to determine which units a given day falls into
2. **Format Templates**: Replaces placeholders in format strings with calculated values
3. **Special Days**: Handles special day labels (e.g., "Festival Day" for quarter end)

### 3. Calendar Presets

**File**: `shared/src/calendars/presets.ts`

Built-in calendar configurations that users can choose from or customize.

#### Coruscant Standard Calendar (Star Wars)

```json
{
  "id": "coruscant",
  "name": "Coruscant Standard Calendar",
  "description": "Galactic standard timekeeping (368 days, BBY/ABY)",
  "minutesPerHour": 60,
  "hoursPerDay": 24,
  "minutesPerDay": 1440,
  "daysPerYear": 368,
  "minutesPerYear": 529920,
  "subdivisions": [
    {
      "id": "quarter",
      "name": "Quarter",
      "pluralName": "Quarters",
      "count": 4,
      "daysPerUnitFixed": 92,
      "labels": [
        "Conference Season",
        "Gala Season",
        "Recess Season",
        "Budget Season"
      ],
      "subdivisions": [
        {
          "id": "week",
          "name": "Week",
          "pluralName": "Weeks",
          "count": 13,
          "daysPerUnitFixed": 7,
          "labelFormat": "Week {n}"
        }
      ]
    }
  ],
  "eras": {
    "positive": "ABY",
    "negative": "BBY"
  },
  "display": {
    "defaultFormat": "{dayLabel}, {quarter} (Q{quarterNumber}), {year} {era} at {hour}:{minute}",
    "shortFormat": "Q{quarterNumber} Day {dayOfQuarter}, {year} {era}",
    "includeTimeByDefault": true,
    "hourFormat": "24"
  },
  "specialDays": {
    "quarter": {
      "92": "Festival Day"
    }
  }
}
```

#### Simple 365-Day Calendar

```json
{
  "id": "simple365",
  "name": "Simple 365-Day Calendar",
  "description": "Basic 365-day year, no subdivisions",
  "minutesPerHour": 60,
  "hoursPerDay": 24,
  "minutesPerDay": 1440,
  "daysPerYear": 365,
  "minutesPerYear": 525600,
  "subdivisions": [],
  "eras": {
    "positive": "AE",
    "negative": "BE"
  },
  "display": {
    "defaultFormat": "Day {dayOfYear}, Year {year} {era} at {hour}:{minute}",
    "shortFormat": "Day {dayOfYear}, Year {year} {era}",
    "includeTimeByDefault": true,
    "hourFormat": "24"
  }
}
```

### 4. Database Schema

**File**: `backend/prisma/schema.prisma`

```prisma
model Story {
  // ... existing fields ...

  // Multiple calendars per story
  calendars        Calendar[]
  defaultCalendarId String?   // Which calendar to use for UI display
}

model Calendar {
  id        String   @id @default(cuid())
  storyId   String
  story     Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)

  // Calendar configuration (stored as JSON)
  config    Json     // Full CalendarConfig object

  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([storyId])
}
```

**Why Multiple Calendars?**
- Different planets/cultures in the same story (e.g., Coruscant vs. Tatooine in Star Wars)
- Local calendar vs. galactic standard
- Historical calendars vs. current calendars
- In-universe calendar vs. simplified author calendar

**Default Calendar**:
- One calendar marked as default (via `defaultCalendarId`)
- UI displays all dates using default calendar
- Users can convert dates between calendars if needed
- If no default set, use first calendar created

**Migration Strategy**:
1. Create `Calendar` model
2. Add `defaultCalendarId` to Story model (nullable)
3. Migrate existing stories: create one Calendar with Coruscant preset, set as default
4. All new stories start with one calendar (Simple365 preset by default)

### 5. Backend Integration

#### Calendar Service

**File**: `backend/src/services/calendarService.ts`

```typescript
import { CalendarEngine } from '@story/shared';
import { CALENDAR_PRESETS } from '@story/shared/calendars/presets';
import { prisma } from '../lib/prisma';
import type { Story, Calendar } from '@prisma/client';
import type { CalendarConfig } from '@story/shared';

/**
 * Get the default calendar for a story
 */
export async function getStoryDefaultCalendar(storyId: string): Promise<CalendarEngine> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: { calendars: true }
  });

  if (!story) {
    throw new Error(`Story ${storyId} not found`);
  }

  // Find default calendar
  const defaultCalendar = story.defaultCalendarId
    ? story.calendars.find(c => c.id === story.defaultCalendarId)
    : story.calendars[0]; // Fallback to first calendar

  if (!defaultCalendar) {
    throw new Error(`No calendars found for story ${storyId}`);
  }

  const config = defaultCalendar.config as CalendarConfig;
  return new CalendarEngine(config);
}

/**
 * Get a specific calendar by ID
 */
export async function getCalendar(calendarId: string): Promise<CalendarEngine> {
  const calendar = await prisma.calendar.findUnique({
    where: { id: calendarId }
  });

  if (!calendar) {
    throw new Error(`Calendar ${calendarId} not found`);
  }

  const config = calendar.config as CalendarConfig;
  return new CalendarEngine(config);
}

/**
 * Get all calendars for a story
 */
export async function getStoryCalendars(storyId: string): Promise<CalendarEngine[]> {
  const calendars = await prisma.calendar.findMany({
    where: { storyId }
  });

  return calendars.map(cal => {
    const config = cal.config as CalendarConfig;
    return new CalendarEngine(config);
  });
}

/**
 * Create a new calendar for a story
 */
export async function createCalendar(
  storyId: string,
  config: CalendarConfig,
  setAsDefault: boolean = false
): Promise<Calendar> {
  const calendar = await prisma.calendar.create({
    data: {
      storyId,
      config: config as any
    }
  });

  if (setAsDefault) {
    await prisma.story.update({
      where: { id: storyId },
      data: { defaultCalendarId: calendar.id }
    });
  }

  return calendar;
}

export function getCalendarPreset(presetId: string): CalendarConfig {
  return CALENDAR_PRESETS[presetId] || CALENDAR_PRESETS.simple365;
}

export function listCalendarPresets(): CalendarConfig[] {
  return Object.values(CALENDAR_PRESETS);
}
```

#### CLI Integration

**File**: `backend/src/cli/index.ts`

Remove duplicate calendar implementation. Use shared CalendarEngine:

```typescript
import { CalendarEngine } from '@story/shared';
import { getStoryCalendar } from '../services/calendarService';

// story:time-display command
program
  .command("story:time-display")
  .description("Format a storyTime value into calendar date")
  .argument("<storyId>", "Story ID")
  .argument("<storyTime>", "Story time in minutes")
  .option("--json", "Output full breakdown as JSON")
  .action(async (storyId: string, storyTimeArg: string, options) => {
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    const calendar = getStoryCalendar(story);
    const time = parseInt(storyTimeArg, 10);
    const date = calendar.storyTimeToDate(time);

    if (options.json) {
      printJSON(date);
    } else {
      console.log(calendar.formatDate(date, true));
    }
  });
```

### 6. Frontend Integration

#### Story Store

**File**: `src/stores/currentStoryStore.ts`

```typescript
import { CalendarEngine } from '@story/shared';

// Add to store
const [defaultCalendar, setDefaultCalendar] = createSignal<CalendarEngine | null>(null);
const [allCalendars, setAllCalendars] = createSignal<Map<string, CalendarEngine>>(new Map());

// Update when story changes
createEffect(() => {
  const story = currentStoryStore.story;
  if (story?.calendars && story.calendars.length > 0) {
    // Build calendar map
    const calendarMap = new Map<string, CalendarEngine>();
    for (const cal of story.calendars) {
      const engine = new CalendarEngine(cal.config);
      calendarMap.set(cal.id, engine);
    }
    setAllCalendars(calendarMap);

    // Set default calendar
    const defaultCalId = story.defaultCalendarId || story.calendars[0].id;
    const defaultEngine = calendarMap.get(defaultCalId);
    if (defaultEngine) {
      setDefaultCalendar(defaultEngine);
    }
  }
});

// Helper to get calendar by ID
export function getCalendarById(calendarId: string): CalendarEngine | undefined {
  return allCalendars().get(calendarId);
}
```

#### Time Picker Component

**File**: `src/components/StoryTimePicker.tsx`

```typescript
import { CalendarEngine } from '@story/shared';
import { currentStoryStore } from '../stores/currentStoryStore';

export const StoryTimePicker: Component<StoryTimePickerProps> = (props) => {
  const calendar = new CalendarEngine(currentStoryStore.story.calendarConfig);

  const date = () => calendar.storyTimeToDate(props.currentTime || 0);
  const preview = () => calendar.formatDate(date(), true);

  // UI adapts to calendar structure
  // - For Coruscant: Show quarter + day selector
  // - For Gregorian: Show month + day selector
  // - For Simple: Show day of year input
};
```

#### Display Components

**File**: `src/components/NodeHeader.tsx`

```typescript
import { CalendarEngine } from '@story/shared';
import { currentStoryStore } from '../stores/currentStoryStore';

// Replace:
// formatStoryTime(props.node.storyTime, true)

// With:
const calendar = new CalendarEngine(currentStoryStore.story.calendarConfig);
calendar.formatStoryTime(props.node.storyTime, true)
```

### 7. Format Template Placeholders

Templates support these placeholders:

**Basic**:
- `{year}` - Absolute year number
- `{era}` - Era label (BBY, ABY, CE, BCE, etc.)
- `{hour}` - Hour (00-23 or 01-12 depending on hourFormat)
- `{minute}` - Minute (00-59)
- `{dayOfYear}` - Day number within year (1-365/368)

**Subdivisions** (dynamic based on config):
- `{subdivisionId}` - Label for the subdivision (e.g., "January", "Conference Season")
- `{subdivisionIdNumber}` - Numeric value (e.g., 1, 2, 3, 4)
- `{dayOfSubdivisionId}` - Day within that subdivision (e.g., day 15 of January)

**Special**:
- `{dayLabel}` - Special day label if defined, otherwise "Day N"

**Examples**:
- Coruscant: `"{dayLabel}, {quarter} (Q{quarterNumber}), {year} {era} at {hour}:{minute}"`
  - Output: `"Day 45, Conference Season (Q1), 22 BBY at 14:30"`
- Gregorian: `"{dayOfWeek}, {month} {dayOfMonth}, {year} {era} at {hour}:{minute}"`
  - Output: `"Monday, March 15, 44 BCE at 02:30 PM"`

## Implementation Plan

### Phase 0: Test-Driven Development Setup ✅ COMPLETE
1. ✅ Set up test infrastructure in `shared/` package (vitest)
2. ✅ Write comprehensive test suite for calendar engine:
   - ✅ Basic time conversion tests (storyTime ↔ date)
   - ✅ Subdivision calculation tests
   - ✅ Format template tests
   - ✅ Edge cases (negative years, year boundaries, special days)
   - ✅ Multiple calendar interaction tests
3. ✅ Write tests for both presets (Coruscant, Simple365)
4. ✅ Tests failed initially (TDD approach confirmed)
5. ✅ **Result: 50/50 tests passing**

### Phase 1: Foundation (Shared Package) ✅ COMPLETE
1. ✅ Create `shared/src/calendars/` directory structure
2. ✅ Implement `types.ts` with type definitions (87 lines)
3. ✅ Implement `engine.ts` with CalendarEngine class (389 lines)
   - ✅ All core conversions working
   - ✅ Hierarchical subdivisions (unlimited depth)
   - ✅ Format template system with conflict detection
   - ✅ Arithmetic and rounding operations
4. ✅ Create `presets.ts` with Coruscant and Simple365 configs (142 lines)
5. ✅ All tests pass (50/50)
6. ✅ Export from `shared/src/index.ts`
7. ✅ Build succeeds

**Files Created:**
- `shared/src/calendars/types.ts` - Type definitions
- `shared/src/calendars/engine.ts` - CalendarEngine implementation
- `shared/src/calendars/engine.test.ts` - 30 core tests
- `shared/src/calendars/subdivisions.test.ts` - 20 nested subdivision tests
- `shared/src/calendars/presets.ts` - Coruscant & Simple365 presets
- `shared/vitest.config.ts` - Test configuration

### Phase 2: Database Migration
1. Create `Calendar` model with config JSON field
2. Add `defaultCalendarId` to Story model (nullable, foreign key to Calendar)
3. Create migration script:
   - For each existing story, create a Calendar record with Coruscant preset
   - Set `defaultCalendarId` to the newly created calendar
4. Add cascading delete: when Story deleted, delete all Calendars
5. Test migration on local database backup

### Phase 3: Backend Integration
1. Create `backend/src/services/calendarService.ts`
2. Update CLI commands to use CalendarEngine
3. Remove duplicate calendar code from `backend/src/cli/index.ts`
4. Add API endpoints for calendar management (if needed)

### Phase 4: Frontend Migration
1. Update `currentStoryStore` to provide CalendarEngine
2. Replace all `formatStoryTime` calls with calendar-based formatting
3. Update `StoryTimePicker` component to be calendar-aware
4. Update `NodeHeader` and other display components
5. Remove old `src/utils/coruscantCalendar.ts` (deprecated)

### Phase 5: UI Enhancements
1. Add calendar preset selector to story creation (defaults to Simple365)
2. Add calendar management UI to story settings:
   - List all calendars for the story
   - Add new calendar (from preset or custom)
   - Edit existing calendar JSON
   - Set default calendar
   - Delete calendar (with confirmation)
3. Add calendar switcher for multi-calendar stories
4. Show calendar info in story details
5. Add calendar preview/documentation

## Benefits

1. **No Hardcoded Calendars**: Everything is JSON configuration
2. **Hierarchical Subdivisions**: Support weeks within months, months within quarters, etc.
3. **User Customizable**: Users can edit JSON to tweak their calendar
4. **Multiple Calendars**: Support different planetary/cultural calendars in same story
5. **Default Calendar**: One calendar for UI display, but others available for reference
6. **Backward Compatible**: Existing stories get migrated to Coruscant config
7. **DRY**: Single implementation shared between frontend, backend, CLI
8. **Extensible**: Add new subdivision types without code changes
9. **Type-Safe**: Full TypeScript support throughout
10. **Test-Driven**: Comprehensive test coverage ensures reliability

## Edge Cases & Considerations

1. **Leap Years**: Not currently handled. Could add `leapYearRule` to config for future enhancement
2. **Variable Hour/Day Lengths**: Config supports different hour/day lengths, but assumes consistency within a calendar
3. **Year Zero**: Gregorian calendar has no year 0 (1 BCE → 1 CE). Handled via `zeroLabel: null`
4. **Nested Subdivisions**: Engine supports arbitrary nesting depth (Months → Weeks → Days of Week)
5. **Calendar Editing**: Users editing calendar JSON could break their story - add validation
6. **Performance**: CalendarEngine instantiated frequently - consider caching per story

## Future Enhancements

1. **Leap Year Support**: Add configurable leap year rules
2. **Calendar Conversion**: Convert dates between different calendars in the same story
3. **Calendar Validation**: UI to validate calendar configs before saving
4. **Visual Calendar Editor**: GUI for building calendars instead of editing JSON
5. **Import/Export**: Share calendar configs between stories/users
6. **Holiday System**: More sophisticated special days (recurring holidays, etc.)
7. **Calendar Templates**: Community-contributed calendar presets library

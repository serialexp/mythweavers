# Technical Debt & Architecture Improvements

This document tracks architectural improvements and technical debt items identified through comprehensive codebase analysis.

## 🔴 High Priority (Do First)

### Large Component Decomposition

- [x] **Break down Maps.tsx (2,495 lines → 1,968 lines → 1,400 lines → ~900 lines after Phase 2)**
  - [x] Extract FactionOverlayControls component
  - [x] Extract MapTimeline component
  - [x] Extract LandmarksList component
  - [x] Extract MapControls component
  - [x] Extract LandmarkPopup component (editing functionality)
  - [x] Create shared types file for map components
  - [x] **Phase 1: Extract Core Infrastructure**
    - [x] Extract usePixiMap hook (~150 lines) - PIXI initialization, viewport, containers
    - [x] Extract landmarkRenderer utilities (~250 lines) - createLandmarkSprite, positionLandmark, landmarkHasChanged
    - [x] Extract colorUtils (~35 lines) - parseColorToHex, ColoredLandmark type
    - [x] Extract voronoiRenderer utilities (~250 lines) - drawStandardVoronoi, drawDistanceField, drawBlurredVoronoi
    - [x] Update Maps.tsx to use all Phase 1 extractions
  - [x] **Phase 2: Extract Management Hooks**
    - [x] Extract useMapLoader hook (~75 lines) - Map loading, sprite lifecycle management
    - [x] Extract useLandmarkManager hook (~145 lines) - Landmark CRUD operations, sprite management
    - [x] Extract useMapInteractions hook (~280 lines) - Mouse/touch interactions, preview handling, drag detection
    - [x] Update Maps.tsx to use all Phase 2 hooks
    - [x] Removed ~500 lines of duplicated/extracted code
  - File: `src/components/Maps.tsx`
  - New components: `src/components/maps/`
  - New hooks: `src/hooks/maps/`
  - New utils: `src/utils/maps/`

- [ ] **Refactor Message.tsx (1,094 lines)**
  - [ ] Extract MessageContent component
  - [ ] Extract MessageActions component
  - [ ] Extract MessageMetadata component
  - File: `src/components/Message.tsx`

- [ ] **Refactor StoryNavigation.tsx (867 lines)**
  - [ ] Extract NodeTree component
  - [ ] Extract NavigationControls component
  - [ ] Extract NodeItem component
  - File: `src/components/StoryNavigation.tsx`

### Backend Optimization

- [ ] **Refactor updateStory.ts (621 lines)**
  - [ ] Split into validateUpdateRequest()
  - [ ] Split into checkVersionConflict()
  - [ ] Split into updateStoryMetadata()
  - [ ] Split into syncMessages()
  - [ ] Split into syncCharacters()
  - [ ] Split into syncNodes()
  - [ ] Split into syncContextItems()
  - [ ] Fix N+1 query problems (lines 370-444)
  - [ ] Implement batch database operations instead of sequential updates
  - File: `backend/src/routes/stories/updateStory.ts`

### Testing Infrastructure

- [ ] **Add comprehensive testing (currently only 3 test files)**
  - [ ] Set up test framework and configuration
  - [ ] Add messagesStore tests (add, delete, reorder, branch paths)
  - [ ] Add saveService tests (queue operations, conflicts)
  - [ ] Add nodeStore tests
  - [ ] Add currentStoryStore tests
  - [ ] Add API endpoint tests
  - [ ] Add component tests for critical components
  - [ ] Target: 70%+ coverage for stores and services

### Production Issues

- [ ] **Fix WebSocket URL hardcoding**
  - [ ] Replace hardcoded localhost:3001 with dynamic URL
  - [ ] Use same pattern as apiClient for runtime config
  - File: `src/utils/websocket.ts:38`

### Migration Cleanup

- [ ] **Complete chapter→node migration**
  - [ ] Remove Chapter model from Prisma schema
  - [ ] Delete src/stores/chaptersStore.ts
  - [ ] Remove chapter-related code in messagesStore
  - [ ] Update components still referencing chapters
  - [ ] Remove ChapterHeader.tsx
  - [ ] Remove ImportChapterButton.tsx
  - [ ] Remove InsertChapterButton.tsx

---

## 🟡 Medium Priority

### State Management Refactoring

- [ ] **Refactor messagesStore.ts (1,659 lines)**
  - [ ] Extract message operations into useMessageOperations hook
  - [ ] Extract validation into useMessageValidation hook
  - [ ] Move complex memos into dedicated utility files
  - [ ] Consider splitting into messagesStore, messageOperationsStore, messageValidationStore
  - File: `src/stores/messagesStore.ts`

- [ ] **Consolidate small UI stores into unified UIStore**
  - [ ] Merge headerStore
  - [ ] Merge uiStore
  - [ ] Merge viewModeStore
  - [ ] Merge rewriteDialogStore
  - [ ] Merge searchModalStore
  - [ ] Create unified UIState interface
  - Files: `src/stores/headerStore.ts`, `uiStore.ts`, `viewModeStore.ts`, `rewriteDialogStore.ts`, `searchModalStore.ts`

- [ ] **Fix store circular dependencies**
  - [ ] Document current dependency graph
  - [ ] Implement dependency injection pattern for stores
  - [ ] Refactor messagesStore ↔ currentStoryStore ↔ nodeStore dependencies

- [ ] **Standardize store patterns**
  - [ ] All stores should export consistent getter interface
  - [ ] Document when to use NoSave variants vs regular methods
  - [ ] Create store template/pattern documentation

### Performance Improvements

- [ ] **Implement virtual scrolling for MessageList**
  - [ ] Install @tanstack/solid-virtual
  - [ ] Replace current For loop with VirtualList
  - [ ] Set appropriate estimateSize based on message types
  - File: `src/components/MessageList.tsx`

- [ ] **Optimize expensive computations**
  - [ ] Add early returns in activePath memo (messagesStore)
  - [ ] Cache activePath results
  - [ ] Add memoization for word counts
  - File: `src/stores/messagesStore.ts`

- [ ] **Implement code splitting**
  - [ ] Lazy load Maps component
  - [ ] Lazy load EpisodeViewer component
  - [ ] Add Suspense boundaries with loading indicators
  - [ ] Analyze bundle size after changes

- [ ] **Database query optimization**
  - [ ] Add index: `idx_message_node_order ON Message(storyId, nodeId, order)`
  - [ ] Add index: `idx_node_story_parent ON Node(storyId, parentId)`
  - [ ] Review and optimize common query patterns
  - File: `backend/prisma/schema.prisma`

### API Architecture

- [ ] **Backend route reorganization**
  - [ ] Group routes into subdirectories (stories/, messages/, characters/, etc.)
  - [ ] Create index.ts routers for each subdirectory
  - [ ] Update imports across backend
  - Directory: `backend/src/routes/`

- [ ] **Implement DTO (Data Transfer Objects) layer**
  - [ ] Create shared types directory
  - [ ] Define request/response DTOs for all endpoints
  - [ ] Add validation schemas using zod
  - [ ] Replace direct Prisma model usage in responses
  - New file: `backend/src/dto/` or `/shared/types/`

- [ ] **Add request validation middleware**
  - [ ] Install zod for schema validation
  - [ ] Create validateRequest middleware
  - [ ] Add validation to all endpoints
  - [ ] Standardize error responses

---

## 🟢 Low Priority (Nice to Have)

### Code Organization

- [ ] **Extract business logic from stores into domain layer**
  - [ ] Create `/src/domain/` directory
  - [ ] Move calculateActivePath to domain service
  - [ ] Move getStoryStats to domain service
  - [ ] Move message filtering logic to domain service
  - [ ] Document domain layer patterns

- [ ] **Create configuration constants**
  - [ ] Create `src/config/constants.ts`
  - [ ] Extract save debounce delays
  - [ ] Extract WebSocket configuration
  - [ ] Extract timeout values
  - [ ] Replace magic numbers throughout codebase

- [ ] **Remove commented code**
  - [ ] Clean up websocket.ts
  - [ ] Clean up messagesStore.ts
  - [ ] Search for other instances

### Component Architecture

- [ ] **Add component documentation**
  - [ ] Add JSDoc to all major components
  - [ ] Document props and callbacks
  - [ ] Add usage examples for complex components

- [ ] **Extract business logic from components**
  - [ ] Create useStoryOperations hook (from StoryManager)
  - [ ] Move complex event handlers to hooks
  - [ ] Reduce inline logic in components

- [ ] **Apply compound component patterns**
  - [ ] Refactor Maps to use compound components
  - [ ] Consider for other complex components

### Data Flow Improvements

- [ ] **Implement optimistic updates**
  - [ ] Add optimistic message updates
  - [ ] Add rollback on error
  - [ ] Improve perceived performance

- [ ] **Prevent WebSocket update loops**
  - [ ] Add update source tracking ('local' | 'websocket' | 'server')
  - [ ] Ignore WebSocket updates matching pending local changes
  - [ ] Add debugging for update cycles

- [ ] **Standardize save triggers**
  - [ ] Document when to use debounced vs immediate saves
  - [ ] Make save behavior consistent across operations
  - [ ] Review version conflict handling

### Type Safety

- [ ] **Eliminate 'any' types**
  - [ ] Fix apiClient.ts any types
  - [ ] Fix StoryManager.tsx any types
  - [ ] Search and replace remaining any types with proper types

- [ ] **Create shared type definitions**
  - [ ] Create `/shared/types/api.ts` for both frontend and backend
  - [ ] Define UpdateMessageRequest, UpdateMessageResponse, etc.
  - [ ] Ensure type consistency across API boundaries

- [ ] **Improve generic typing**
  - [ ] Add better typing to SaveOperation
  - [ ] Use mapped types for EntityDataMap
  - [ ] Add discriminated unions where appropriate

- [ ] **Add runtime validation**
  - [ ] Install zod
  - [ ] Create schemas for critical data structures
  - [ ] Validate at API boundaries
  - [ ] Add type guards for unknown data

- [ ] **Fix excessive type assertions**
  - [ ] Replace `as any as AuthRequest` with proper typing
  - [ ] Create proper middleware type definitions
  - Files: Backend route files

### Testing & Quality

- [ ] **Add linting rules**
  - [ ] Configure ESLint for common issues
  - [ ] Add rule for no magic numbers
  - [ ] Add rule for consistent store patterns
  - [ ] Add pre-commit hooks

- [ ] **Create coding standards document**
  - [ ] Document store patterns
  - [ ] Document component patterns
  - [ ] Document error handling patterns
  - [ ] Create component templates

### Maintainability

- [ ] **Consolidate duplicate logic**
  - [ ] Message filtering appears in multiple places - centralize
  - [ ] Review for other duplication
  - File: Search across codebase

- [ ] **Standardize naming conventions**
  - [ ] Review getCurrentChapterId vs getCurrentNodeId patterns
  - [ ] Ensure consistent naming across similar functions
  - [ ] Update naming conventions document

---

## 📋 Architectural Patterns to Adopt

### Domain-Driven Design (DDD)
- [ ] Create `/src/domain/` directory structure
- [ ] Separate domain models from UI models
- [ ] Use value objects for complex types
- [ ] Define bounded contexts

### Command Query Responsibility Segregation (CQRS)
- [ ] Separate read and write operations in stores
- [ ] Different models for queries vs commands
- [ ] Optimize each independently

### Repository Pattern
- [ ] Abstract data access behind repositories
- [ ] Create repository interfaces
- [ ] Single source for data operations
- [ ] Make testing easier with mock repositories

### Facade Pattern
- [ ] Review SaveService as good example
- [ ] Apply to other complex subsystems
- [ ] Provide unified interfaces
- [ ] Hide implementation details

---

## 📊 Metrics & Goals

### Current State
- **Largest files:**
  - Maps.tsx: 2,495 lines
  - messagesStore.ts: 1,659 lines
  - Message.tsx: 1,094 lines
  - StoryNavigation.tsx: 867 lines
  - updateStory.ts: 621 lines

- **Total component lines:** 16,764
- **Total store lines:** 5,307
- **Test files:** 3
- **Number of stores:** 27

### Target Goals
- [ ] No file over 500 lines
- [ ] Test coverage > 70% for stores and services
- [ ] Reduce number of stores to ~15 through consolidation
- [ ] All components under 300 lines
- [ ] Zero 'any' types in core code
- [ ] All API endpoints with validation
- [ ] Bundle size reduction of 30%+

---

## 🔍 Quick Wins (Low Effort, High Impact)

- [ ] Fix WebSocket URL hardcoding
- [ ] Remove commented code
- [ ] Add JSDoc to top 10 most-used components
- [ ] Create constants.ts for magic numbers
- [ ] Add database indexes for common queries
- [ ] Fix type assertions in auth middleware
- [ ] Add basic component tests for critical paths

---

## 📝 Notes & Decisions

### Completed Items
*(Move completed items here with date and notes)*

### Deferred Items
*(Items we've decided not to do, with reasoning)*

### Architecture Decisions
*(Document key architectural decisions made during refactoring)*

---

**Last Updated:** 2025-10-04
**Analysis Date:** 2025-10-04
**Total Tasks:** 135+

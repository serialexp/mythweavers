# Codebase Improvement Recommendations

## ✅ Completed Improvements

### Type Safety (DONE)
- Replaced all `any[]` with proper types (`Message[]`, `Character[]`, `ContextItem[]`, `Chapter[]`)
- Created type-safe error handling utilities in `src/utils/errorHandling.ts`
- Added `VersionConflictError` class for proper error typing
- Fixed script data types with recursive `ScriptDataValue` type
- Replaced `Function` type with `(...args: unknown[]) => unknown`
- All TypeScript errors resolved - `pnpm run typecheck` passes

## 🔴 Critical Issues to Address

### 1. Code Duplication (40+ instances)
**Problem**: Repeated error handling patterns across components
- Same `console.error('Failed to...')` pattern in multiple files
- Duplicated HTTP client logic in LLM providers (Anthropic, OpenAI, OpenRouter)
- Similar store initialization patterns across all stores

**Solution**:
- Create centralized error handling with user notifications
- Extract base HTTP client class for LLM providers
- Create store factory functions for common patterns

### 2. Store Complexity
**Problem**: `messagesStore.ts` is 800+ lines handling too many responsibilities
- Auto-save logic mixed with message operations
- Conflict resolution mixed with data loading
- Circular dependencies requiring dynamic imports

**Solution**:
- Split into separate modules:
  - `messagePersistence.ts` - saving/loading
  - `messageConflicts.ts` - conflict resolution
  - `messageOperations.ts` - CRUD operations
- Use event-driven architecture to break circular dependencies

### 3. Component Bloat
**Problem**: Large components doing too much
- `StoryManager.tsx` (600+ lines) handles story management, refinement, server sync, modals
- `MessageList.tsx` handles rendering, chapter management, and generation

**Solution**:
- Extract into smaller, focused components
- Use composition over inheritance
- Separate concerns (display vs business logic)

## 🟡 Architecture Improvements

### 1. Business Logic Duplication
**Problem**: Same logic exists in frontend and backend
- Story validation in both places
- System prompt building duplicated in frontend and MCP server
- ID generation without uniqueness validation

**Solution**:
- Move shared logic to backend or create shared utilities package
- Centralize validation rules
- Add ID uniqueness checks

### 2. MCP Server Issues
**Problem**: `/backend/src/mcp/storyServer.ts` has issues
- Tightly coupled to database
- Missing error handling in tool implementations
- No input validation for tool parameters

**Solution**:
- Add abstraction layer between MCP tools and database
- Implement comprehensive error handling
- Add zod validation for all tool inputs

### 3. Missing Error Recovery
**Problem**: Errors are logged but not handled gracefully
- No user feedback for failures
- No retry mechanisms
- No fallback strategies

**Solution**:
- Implement toast/notification system for user feedback
- Add retry logic with exponential backoff
- Create fallback UI states for errors

## 🟢 Performance Optimizations

### 1. Inefficient Re-renders
**Problem**: Components re-render unnecessarily
- `createMemo` without proper dependency optimization
- Heavy computations in render paths
- No virtual scrolling for long message lists

**Solution**:
- Audit and optimize reactive dependencies
- Implement virtual scrolling for MessageList
- Move heavy computations outside render cycle

### 2. Memory Leaks
**Problem**: Effects without cleanup
- 25 files using `createEffect` without cleanup functions
- Event listeners not removed
- Subscriptions not unsubscribed

**Solution**:
- Add cleanup functions to all effects
- Use `onCleanup` consistently
- Implement proper lifecycle management

## 📝 Quick Wins (Can be done immediately)

1. **Delete .bak files**: 
   - `modelsStore.refactored.ts.bak`
   - `useOllama.refactored.ts.bak`
   - `analysisClient.refactored.ts.bak`

2. **Fix missing CSS module**:
   - `InsertMessageButton.module.css` is deleted but still referenced

3. **Remove commented code**:
   - Search for `//` and `/* */` blocks that are old code

4. **Standardize imports**:
   - Some files use double quotes, others use single quotes
   - Inconsistent import ordering

## 🎯 Recommended Priority Order

1. **High Priority** (Do first)
   - Extract error handling utility (improves UX immediately)
   - Split messagesStore.ts (reduces complexity)
   - Delete .bak files (cleanup)

2. **Medium Priority** (Do next)
   - Extract common HTTP client patterns
   - Break down large components
   - Add user notifications for errors

3. **Low Priority** (Nice to have)
   - Optimize memos and effects
   - Implement virtual scrolling
   - Add comprehensive tests

## 📊 Metrics to Track

After implementing improvements, monitor:
- Bundle size reduction
- Type coverage percentage
- Component render counts
- Error rate in production
- Code duplication percentage (use tools like jscpd)

## 🛠️ Tooling Recommendations

Consider adding:
- **ESLint** with strict rules for consistency
- **Prettier** for code formatting
- **Husky** for pre-commit hooks
- **Bundle analyzer** to track size
- **Sentry** for error monitoring in production
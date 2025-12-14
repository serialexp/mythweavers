# Architecture Improvements Plan

## 1. **Component Architecture Issues**
- **App.tsx is massive (1211 lines)** - needs to be broken down into smaller, focused components
- **App.css is enormous (3079 lines)** - should be split into CSS modules per component (you already use this pattern for some components)
- Too much business logic in App.tsx instead of custom hooks or services

## 2. **API Client Duplication**
- Three separate API clients (anthropic, openrouter, ollama) with duplicate interfaces:
  - `ChatMessage` interface defined 5 times across different files
  - Similar streaming/generation logic repeated in each client
  - Should create a unified API abstraction layer with provider-specific implementations

## 3. **Type System Redundancy**
- Multiple definitions of similar message types across utils
- No centralized type definitions for API responses
- Missing shared interfaces for common patterns

## 4. **State Management Concerns**
- 9 separate stores without clear separation of concerns
- Direct localStorage access in multiple places instead of centralized persistence
- Missing proper error boundaries for store operations

## 5. **Error Handling Inconsistencies**
- 96 error handling instances across 14 files with varying patterns
- Mix of console.error, console.warn without structured logging
- No centralized error handling strategy

## 6. **Backend/Frontend Separation**
- Backend folder exists but underutilized
- API routes mixed with client-side logic
- Refinement service isolated in backend but other services aren't

## 7. **Missing Architectural Patterns**
- No clear service layer - business logic scattered across components, hooks, and utils
- No dependency injection or inversion of control
- Missing proper abstraction boundaries

## Recommended Refactoring Priority:
1. **Extract App.tsx logic** into focused components and hooks
2. **Create unified API client interface** with provider implementations
3. **Implement CSS modules** for all components
4. **Consolidate type definitions** into shared types
5. **Create service layer** for business logic
6. **Implement structured error handling** and logging

## Progress Tracking

### 1. Extract App.tsx Logic
- [x] Create StoryInput component
- [x] Create StoryGeneration hook
- [x] Create CacheManagement hook
- [ ] Create EntityDetection hook
- [ ] Create AutoGeneration hook
- [x] Move event handlers to appropriate hooks
- [ ] Extract utility functions to services
- [x] Create StoryHeader component
- [x] Create ContextPreviewModal component
- [x] Create App.module.css
- [x] Reduce App.tsx from 1211 lines to ~350 lines

### 2. Create Unified API Client Interface
- [x] Define common interface for all LLM providers
- [x] Create base client class
- [x] Refactor existing clients to implement interface
- [x] Remove duplicate type definitions
- [x] Create LLMClientFactory for client instantiation
- [x] Update hooks and stores to use unified clients
- [ ] Complete migration and test all providers

### 3. Implement CSS Modules
- [x] Split App.css into component-specific modules
- [x] Convert existing styles to CSS modules
- [x] Create CSS modules for all major components:
  - MessageList.module.css
  - Message.module.css
  - Settings.module.css
  - GlobalStatusIndicator.module.css
  - StoryManager.module.css
  - Characters.module.css
  - ContextItems.module.css
  - CompactionDialog.module.css
- [x] Create minimal App.css with only global utilities
- [ ] Update components to use CSS modules instead of global classes
- [ ] Remove old App.css once migration is complete

### 4. Consolidate Type Definitions
- [ ] Create types/api.ts for API-related types
- [ ] Create types/llm.ts for LLM provider types
- [ ] Update imports across codebase

### 5. Create Service Layer
- [ ] Create services/storyService.ts
- [ ] Create services/entityService.ts
- [ ] Create services/cacheService.ts
- [ ] Move business logic from components

### 6. Implement Structured Error Handling
- [ ] Create utils/logger.ts with structured logging
- [ ] Create error boundary components
- [ ] Implement consistent error handling patterns
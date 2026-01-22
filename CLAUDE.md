# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Writer2 Monorepo Guide

## Commands
- `pnpm dev` - Start all services (server, reader, writer)
- `pnpm dev:reader` - Start reader app only
- `pnpm dev:server` - Start server only
- `pnpm dev:writer` - Start writer app (run from writer directory)
- `pnpm build` - Build all packages
- `pnpm build:shared` - Build shared package only
- `pnpm test` - Run all tests
- `pnpm --filter @writer/writer test` - Run writer tests
- `pnpm --filter @writer/writer test "testName"` - Run specific test
- `pnpm tauri dev` - Run Tauri desktop app (from writer directory)
- `pnpm tauri build` - Build desktop app for distribution

## Architecture
- **Monorepo Structure**: pnpm workspaces with `apps/*` configuration
- **Apps**:
  - `writer`: SolidJS + Tauri desktop app for writing stories
  - `reader`: React web app for reading stories (being migrated to reader-solid)
  - `reader-solid`: New SolidJS version of reader app
  - `server`: Fastify + tRPC + Prisma backend API
  - `shared`: Shared types and utilities
- **State Management**: Custom stores in writer, Redux Toolkit in reader
- **Database**: MySQL (server via Prisma), SQLite (local writer via Drizzle)

## Code Style
- **Formatting**: Biome.js (2-space indentation, no semicolons)
- **Components**: Writer uses SolidJS, Reader uses React (migrating to SolidJS)
- **CSS**: Tailwind with DaisyUI components
- **Types**: TypeScript with strict mode enabled
- **Naming**: camelCase for functions/variables, PascalCase for types/components
- **Imports**: Group by npm packages first, then local modules
- **File Organization**: Colocate related files (component + styles + tests)

## Git Commits
Use conventional commit format for all commit messages:

```
<type>: <description>

[optional body]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Types:**
- `feat`: New feature or functionality
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only changes
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, config, etc.)

**Examples:**
- `feat: Add CYOA format import support`
- `fix: Correct auth token validation in middleware`
- `refactor: Extract message conversion to separate function`

## Critical Systems

### AI/LLM Integration
- **Location**: `/apps/writer/src/lib/llm/`
- **Providers**: OpenAI, Anthropic, Google Gemini, Groq, Cerebras, Ollama
- **Interface**: All providers implement `LlmInterface` for consistency
- **Usage**: Through `useAi()` function with story-specific instructions
- **Key Files**:
  - `llm/interface.ts` - Common LLM interface
  - `llm/openai.ts`, `llm/anthropic.ts`, etc. - Provider implementations
  - `stores/ai.ts` - AI state management

### Database (Prisma)
- **Schema**: `/apps/server/prisma/schema.prisma`
- **Structure**: Story → Books → Arcs → Chapters → Scenes → Paragraphs
- **Key Models**: User, Story, Character, Location, PlotPoint, File
- **Migrations**: Run `pnpm prisma migrate dev` in server directory
- **Client Generation**: `pnpm prisma generate` after schema changes

### Authentication
- **Type**: Token-based with Bearer tokens
- **Models**: Session (user sessions), AccessKey (API access)
- **Procedures**: public, protected (requires auth), admin (requires admin role)
- **Session Duration**: 24 hours, auto-extends on use

### API Design
- **Framework**: tRPC for type-safe APIs
- **Routers**: Located in `/apps/server/src/trpc/routers/`
- **Main Routers**: auth, stories, publishing, users, files
- **Publishing**: Royal Road integration for story publishing

## Error Handling
- Use try/catch for async operations
- Propagate errors through tRPC procedures
- Log errors with appropriate context
- Return user-friendly error messages

## Debugging and Problem-Solving Principles

**CRITICAL: Never simplify as a first response to a perceived problem.**

When encountering errors or issues:
1. **Investigate first** - Understand the root cause before making changes
2. **Check the basics** - Is the server/process running with the latest code? Are dependencies installed?
3. **Read documentation** - Look up the actual API/usage patterns in docs or examples
4. **Debug systematically** - Use logs, check imports, verify versions
5. **NEVER remove features** as an immediate response to an error
6. **NEVER simplify working code** just because something else broke

❌ **DON'T**: Remove `.meta()` calls because they cause an error
✅ **DO**: Investigate why `.meta()` isn't working (wrong version? server not restarted? incorrect import?)

❌ **DON'T**: Strip out OpenAPI metadata when there's a compilation error
✅ **DO**: Check if dependencies are installed, server is restarted, or documentation shows the correct API

**The goal is to solve problems while preserving functionality, not to remove functionality to avoid problems.**
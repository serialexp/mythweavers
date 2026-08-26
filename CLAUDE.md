# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MythWeavers Monorepo Guide

## Commands

Root-level scripts (see `package.json`):
- `pnpm dev` - Start the full dev stack concurrently: backend, reader, story-editor, admin, plus `stripe listen`
- `pnpm dev:backend` - Start backend only (`@mythweavers/backend`)
- `pnpm dev:editor` - Start the story-editor (writer) app only
- `pnpm dev:reader` - Start the Astro reading frontend only
- `pnpm dev:legacy-server` - Start the legacy writer backend (only needed for migrations / legacy data access)
- `pnpm build` - Build all packages recursively
- `pnpm build:shared` - Build `@mythweavers/shared` only
- `pnpm test` - Run tests across all workspaces
- `pnpm lint` / `pnpm lint:fix` / `pnpm format` / `pnpm check` - Biome
- `pnpm db:migrate` - Run Prisma migrations against `apps/mythweavers-backend`
- `pnpm db:studio` - Open Prisma Studio against `apps/mythweavers-backend`
- `pnpm docker:build` / `docker:build:backend` / `docker:build:editor` / `docker:build:reader` - Depot bake builds

App-specific:
- `pnpm --filter @mythweavers/backend test` - Backend tests (bun test)
- `pnpm --filter @mythweavers/story-editor test` - Story-editor tests (vitest)
- `pnpm --filter @mythweavers/story-editor typecheck` - Story-editor TypeScript check
- `pnpm --filter @mythweavers/story-editor generate:client` - Regenerate the OpenAPI client (requires backend running on port 3201)

## Architecture

- **Monorepo Structure**: pnpm workspaces — `apps/*` and `packages/*` (see `pnpm-workspace.yaml`)
- **Active apps**:
  - `apps/mythweavers-backend` (`@mythweavers/backend`) - Fastify + Zod + Prisma REST API with auto-generated OpenAPI spec
  - `apps/mythweavers-story-editor` (`@mythweavers/story-editor`) - SolidJS writer app (the "writer"); consumes backend via Hey-API-generated client
  - `apps/mythweavers-reading-frontend-astro` (`@mythweavers/reading-frontend-astro`) - Astro + SolidJS public-facing reader
  - `apps/mythweavers-admin` (`@mythweavers/admin`) - SolidJS admin dashboard; also consumes backend via generated client
- **Legacy apps** (still in tree, retained for data migration and reference only — do not build features on these):
  - `apps/writer-legacy-backend`, `apps/writer-legacy-frontend` - previous Writer stack (tRPC, MySQL)
  - `apps/story-legacy-backend`, `apps/reader-legacy`, `apps/mythweavers-reading-frontend-legacy`, `apps/mcp-server-legacy`, `apps/claude-writer` - older iterations
- **Shared packages**:
  - `apps/shared` (`@mythweavers/shared`) - shared Zod schemas / types used across apps
  - `packages/llm` (`@mythweavers/llm`) - LLM provider abstractions (OpenAI, Anthropic, etc.)
  - `packages/ui` (`@mythweavers/ui`) - shared UI components
  - `packages/solid-editor`, `packages/image-cropper`, `packages/story-shared`, `packages/histoire-plugin-solid`
- **State Management**: SolidJS stores in the story-editor (see `apps/mythweavers-story-editor/src/stores/`). All persistence goes through `saveService` — never bypass it.
- **Database**: PostgreSQL via Prisma (backend). Schema: `apps/mythweavers-backend/prisma/schema.prisma`. A secondary schema `prisma/story-source.prisma` is used for legacy migration tooling.

## Code Style
- **Formatting**: Biome.js (2-space indentation, no semicolons)
- **Components**: SolidJS across active apps (story-editor, admin, reader). React only exists in legacy apps.
- **CSS**: Vanilla Extract CSS modules in story-editor/admin (one `.module.css` per component); Tailwind + DaisyUI only in legacy code.
- **CSS Variables**: Use tokens from `apps/mythweavers-story-editor/src/styles/variables.css` — never hardcode colors.
- **Types**: TypeScript with strict mode enabled
- **Naming**: camelCase for functions/variables, PascalCase for types/components
- **Imports**: Group npm packages first, then local modules; no dynamic imports unless genuinely needed
- **IDs**: Always use `generateMessageId()` from `apps/mythweavers-story-editor/src/utils/id.ts` (cuid2-based) for any generated IDs.

## Respect Configured Limits
- **Never introduce an arbitrary limit based on what seems reasonable. It is always wrong.** This includes token/output caps, thinking budgets, timeouts, result counts, payload sizes, retries, and similar constraints.
- When a limit is resolved from user, category, provider, or application configuration, pass that resolved value through unchanged. Do not silently clamp it with `Math.min`, replace it with a hard-coded cap, or add a second limit at the call site.
- If an external API imposes a mandatory limit, use the authoritative provider/API value and make that constraint explicit in code. If the correct limit is unknown or requires a product decision, ask rather than inventing one.

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
- `feat: Add scheduled chapter publishing to reading frontend`
- `fix: Correct session cookie handling in middleware`
- `refactor: Extract message conversion to separate function`

## Critical Systems

### AI/LLM Integration
- **Location**: `packages/llm` (`@mythweavers/llm`) — shared across backend and story-editor
- **Providers**: OpenAI, Anthropic, Google Gemini, Groq, Cerebras, Ollama, OpenRouter
- **Usage**: Imported as `@mythweavers/llm` by any app that needs LLM access
- **Story-editor integration**: Test story generation with both Anthropic and OpenRouter providers. Cache control points are load-bearing — do not remove them.

### Database (Prisma)
- **Engine**: PostgreSQL
- **Schema**: `apps/mythweavers-backend/prisma/schema.prisma`
- **Secondary schema**: `apps/mythweavers-backend/prisma/story-source.prisma` (legacy migration source)
- **Structure**: Story → Books → Arcs → Chapters (all unified as `Node`) → Messages/Paragraphs
- **Key models**: User, Session, Story, Node, Message, Character, Location, PlotPoint, File, ChapterPublishing
- **Migrations**: NEVER manually write migration SQL files. Prisma must generate them via `pnpm db:migrate` (or `pnpm --filter @mythweavers/backend prisma:migrate`) for proper tracking. If you cannot run migrations (no DB connection, or destructive/interactive), update the schema and leave a note in `CURRENT_TASK.md` asking Bart to create/run it. Prisma will refuse interactive operations in non-interactive shells — Bart must run those himself.
- **Client Generation**: `pnpm --filter @mythweavers/backend prisma:generate` after schema changes.

### Authentication
- **Type**: Session-based with httpOnly cookies (see `apps/mythweavers-backend` auth routes)
- **Session Duration**: Auto-extends on use
- Frontends call the backend with `credentials: 'include'`; the generated SDK handles this.

### API Design
- **Framework**: Fastify + Zod v4 + `fastify-zod-openapi` on the backend (NOT tRPC — tRPC only exists in `writer-legacy-backend`)
- **Routes**: `apps/mythweavers-backend/src/routes/` — organized by resource (`auth/`, `stories/`, `my/`, `admin/`, `calendars/`, `tags/`, `webhooks/`, `oauth/`, `device/`, plus `ws.ts`)
- **OpenAPI docs**: Available at `http://localhost:3201/docs` when the backend is running
- **Frontend client**: Each frontend app (story-editor, admin) generates a typed SDK from the OpenAPI spec via `@hey-api/openapi-ts` (`pnpm generate:client`). The generated client lives in `src/api-client/` and is re-exported from `src/client/config.ts`. **Always** use the generated SDK — never write manual fetch calls.
- **Writing endpoints**: See `apps/mythweavers-backend/CLAUDE.md` for the full endpoint pattern (Zod schemas with `.meta()`, response schemas for all status codes, and required tests in `tests/`). New routes must be registered in BOTH `src/index.ts` and `tests/helpers.ts`.

### Publishing (status: partially designed, mostly unimplemented on the new stack)
- **Target use case**: Scheduled publishing of chapters from the story-editor to the Astro reading frontend. Royal Road publishing is a secondary nice-to-have.
- **Schema in place**: `Story.published`, `Chapter.publishedOn`, `Chapter.royalRoadId`, `Story.royalRoadId`, and the `ChapterPublishing` model exist in `apps/mythweavers-backend/prisma/schema.prisma`, but no API routes currently read or write them (outside of export/import serialization).
- **No UI**: The story-editor has no publishing components or stores yet.
- **Reference implementation**: Legacy Royal Road publishing lives in `apps/writer-legacy-backend/src/procedures/publish-to-royal-road.ts` and `sync-royal-road-publishing.ts`, with UI hooks in `apps/writer-legacy-frontend/src/components/` (StoryStatus, StorySettings, WriteHeaderMenu, ChapterTabs). Useful as a reference only — the new implementation targets the Astro reader, not Royal Road.

## Error Handling
- Use try/catch for async operations
- Return user-friendly error messages through Zod-validated error responses
- Log errors with appropriate context
- All backend endpoints must declare response schemas for error status codes (400/401/403/404/409/500)

## Debugging and Problem-Solving Principles

**CRITICAL: Never simplify as a first response to a perceived problem.**

When encountering errors or issues:
1. **Investigate first** - Understand the root cause before making changes
2. **Check the basics** - Is the server/process running with the latest code? Are dependencies installed? Did you regenerate the OpenAPI client after backend changes?
3. **Read documentation** - Look up the actual API/usage patterns in docs or examples
4. **Debug systematically** - Use logs, check imports, verify versions
5. **NEVER remove features** as an immediate response to an error
6. **NEVER simplify working code** just because something else broke

❌ **DON'T**: Remove `.meta()` calls because they cause an error
✅ **DO**: Investigate why `.meta()` isn't working (wrong Zod version? server not restarted? incorrect import?)

❌ **DON'T**: Strip out OpenAPI metadata when there's a compilation error
✅ **DO**: Check if dependencies are installed, server is restarted, or documentation shows the correct API

**The goal is to solve problems while preserving functionality, not to remove functionality to avoid problems.**

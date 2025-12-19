# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev                 # Start Vite dev server on port 3000

# Build
pnpm build              # Build the application with Vite

# Type checking
pnpm tsc                # Run TypeScript type checking without emitting files

# Linting
pnpm lint               # Run Biome linter

# Testing
pnpm test               # Run tests with Vitest

# Database
pnpm drizzle            # Run Drizzle Kit commands

# Tauri-specific
pnpm download-typst     # Download Typst binaries for Tauri
```

## High-Level Architecture

This is a **Tauri desktop application** for creative writing, built with:
- **Frontend**: SolidJS (not React!) with Vite, TypeScript, and TailwindCSS
- **Desktop**: Tauri v2 for native desktop functionality
- **Database**: SQLite with Drizzle ORM (migrations in `src-tauri/migrations/`)
- **State Management**: SolidJS stores in `src/lib/stores/`
- **AI Integration**: Multiple LLM providers (Anthropic, OpenAI, Gemini, Groq, Ollama, Cerebras)

### Key Architectural Components

1. **Monorepo Structure**: Part of a pnpm workspace with shared packages (`@writer/shared`, `@writer/server`)

2. **Editor System**: 
   - ProseMirror-based rich text editor in `src/components/editor/`
   - Custom plugins for paragraph management, inline menus, and AI suggestions
   - Scene-based content organization

3. **Story Structure**:
   - Hierarchical: Story → Books → Arcs → Chapters → Scenes → Paragraphs
   - Each level has its own store and UI components
   - Tree-based navigation system

4. **AI Features**:
   - Content generation and refinement
   - Multiple instruction templates in `src/lib/ai-instructions/`
   - Embeddings and RAG retrieval for context-aware generation

5. **Snowflake Method**: Alternative story planning interface in `src/components/snowflake/`

6. **Sync System**: 
   - Local file storage with JSON format
   - Optional server sync via TRPC client
   - Conflict resolution for collaborative editing

### Important Technical Notes

- **SolidJS, not React**: Uses signals and reactive primitives, not hooks
- **Tauri Security**: Configured permissions in `tauri.conf.json` for file system, dialog, and shell access
- **Typst Integration**: External binary for document compilation
- **Build Target**: Different targets for Windows (Chrome 105) vs macOS/Linux (Safari 13)
# Story CLI

## Overview

The backend exposes a Node-based command line interface that mirrors the story management
capabilities previously provided by the MCP server. The CLI reuses the same data access
logic as the HTTP API, so changes to persistence or business rules automatically apply to
both surfaces.

## Installation

From the repository root:

```bash
cd backend
npm install
npm run build
```

This compiles the CLI to `dist/cli/index.js` and makes the `story-cli` binary available via
`npm link` or `npm exec`.

## Usage

The CLI supports the following command groups:

- `stories:*` – list, retrieve, create, update, search, and inspect overall stats
- `nodes:*` – manage hierarchical book/arc/chapter nodes (list, create, update, delete)
- `messages:*` – list, create, update, delete, replace text, and search messages
- `characters:*` – view characters or evaluate them at a specific message
- `context:generate` – build the full continuation context for a given story turn

Each command returns JSON so it can be piped into other tools or parsed by models.

Example:

```bash
npm --prefix backend run cli -- stories:list
```

To insert message content from a file or stdin you can use the `@file:` prefix or pipe data:

```bash
story-cli messages:create <storyId> <nodeId> --content @file:message.md
cat rewrite.txt | story-cli messages:update <storyId> <messageId>
```

## Environment

The CLI loads configuration from `.env` in the repository root (or `backend/.env` when
present). Ensure the Prisma `DATABASE_URL` points to the same database instance used by the
backend API.

## Contributing

When adding new story operations, implement the logic in `src/story/storyOperations.ts`
and consume it from both the HTTP handlers and the CLI so functionality stays in sync.

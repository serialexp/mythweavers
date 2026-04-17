# Current Task: Provider Balance Ledger with Automated Cost Sync

## Status: Implementation Complete — Needs Prisma Migration

## What Was Done

Added a provider balance/ledger system to the mythweavers admin that tracks:
- **Top-ups**: Manual entries for when you add credits to a provider
- **Cost syncs**: Automatically synced from OpenAI and Anthropic cost APIs every hour

### Files created
- `apps/mythweavers-backend/src/lib/provider-costs.ts` — Shared cost-fetching and upsert logic
- `apps/mythweavers-backend/src/lib/cost-sync-scheduler.ts` — Hourly background scheduler
- `apps/mythweavers-backend/tests/admin-llm-balance.test.ts` — 22 tests, all passing
- `apps/mythweavers-admin/src/components/ProviderBalanceTab.tsx` — Balance tab component
- `apps/mythweavers-admin/src/components/ProviderBalanceTab.css.ts` — Styles

### Files modified
- `apps/mythweavers-backend/prisma/schema.prisma` — Added `LlmProviderTransaction` model and `LlmProviderTransactionType` enum
- `apps/mythweavers-backend/src/routes/admin/llm.ts` — Added 4 endpoints, uses shared cost sync module
- `apps/mythweavers-backend/src/index.ts` — Starts/stops cost sync scheduler
- `apps/mythweavers-admin/src/pages/ProviderDetailPage.tsx` — Added Balance tab
- `apps/mythweavers-admin/src/pages/ProvidersPage.tsx` — Added inline balance display per provider

## Architecture

### Cost Sync Scheduler
- Runs automatically every hour (first run 10s after server start)
- Syncs yesterday + today for all enabled non-Cloudflare providers
- Uses **upsert** logic: re-syncing the same day updates the amount as costs grow
- Each provider syncs independently — one failure doesn't block others
- Graceful shutdown via SIGINT/SIGTERM handlers

### Balance Calculation
- `balance = sum(TOP_UP amounts) - sum(COST_SYNC amounts)`
- Deduplication via `syncKey` (e.g. `anthropic:2026-04-10`)
- Upsert ensures today's cost stays current as it grows throughout the day

### Manual Sync
- Still available via the admin UI "Sync Costs" button for arbitrary date ranges
- Also uses upsert — safe to run multiple times

## What Bart Needs To Do

### 1. Run Prisma Migration
```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name add_llm_provider_transactions
```

### 2. Set Admin API Keys (for cost sync)
- `ANTHROPIC_ADMIN_API_KEY` — from https://console.anthropic.com (needs admin role, key starts with `sk-ant-admin...`)
- `OPENAI_ADMIN_API_KEY` — from OpenAI platform settings
- Falls back to the provider's regular API key if admin keys aren't set

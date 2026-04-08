# Current Task: Consolidate LLM Clients into Shared Package

## Status: DONE — migration complete, verified

## What Was Done

The `@mythweavers/llm` shared package has been created and all LLM streaming code migrated to use it.

### New Package: `packages/llm/`

- `src/types.ts` — `LLMStreamEvent` discriminated union, `TokenUsage`, `NormalizedTokenUsage`, `LLMMessage`, `LLMGenerateOptions`, `ModelPricing`, `LLMModel`, `ConfigOrGetter`, `LLMClient` interface
- `src/utils/sse-parser.ts` — shared SSE parser (extracted from 6+ copies)
- `src/utils/ndjson-parser.ts` — shared NDJSON parser (for Ollama)
- `src/clients/anthropic.ts` — `AnthropicClient` with prompt caching, pricing lookup
- `src/clients/openai-compatible.ts` — `OpenAICompatibleClient` (replaces both OpenAI and OpenRouter clients)
- `src/clients/ollama.ts` — `OllamaClient` using raw HTTP (no `ollama` SDK dependency)
- `src/index.ts` — public API

### Backend Changes

- `apps/mythweavers-backend/src/routes/my/llm.ts` — replaced `streamAnthropic()` and `streamOpenAICompatible()` with shared client `generate()` generators. Billing, route wiring, and `writeSSE()` stay in place.
- Added `@mythweavers/llm` dependency

### Frontend Changes

- `types/llm.ts` — now re-exports from `@mythweavers/llm` (no more local `LLMGenerateResponse`)
- `types/core.ts` — `TokenUsage` is now `NormalizedTokenUsage` re-exported from shared
- `utils/llm/LLMClientFactory.ts` — instantiates shared clients (`AnthropicClient`, `OpenAICompatibleClient`, `OllamaClient`, `ServerLLMClient`), `LoggedLLMClient` updated for `LLMStreamEvent`
- `utils/llm/ServerLLMClient.ts` — rewritten to use shared `parseSSEStream`, yields `LLMStreamEvent`
- `utils/analysisClient.ts` — rewritten to use `LLMClientFactory` and `resolveModel()`
- All consumers migrated: `useOllama.ts`, `templateAI.ts`, `clicheRefinement.ts`, `splitScene.ts`, `SceneEditorWrapper.tsx`, `AdventurePage.tsx`, `MessageRewriter.tsx`, `SingleRewriteDialog.tsx`, `MassRewriteDialog.tsx`
- `llmActivityStore.ts` — uses shared `TokenUsage` for rawUsage
- `LlmActivityPanel.tsx` — updated cache display for new type shape
- Added `@mythweavers/llm` dependency, removed `ollama` dependency

### Files Deleted

- `utils/llm/AnthropicLLMClient.ts`
- `utils/llm/OpenAILLMClient.ts`
- `utils/llm/OpenRouterLLMClient.ts`
- `utils/llm/OllamaLLMClient.ts`
- `utils/llm/BaseLLMClient.ts`
- `utils/ollamaClient.ts`
- `utils/openrouterClient.ts`

### Verification

- `@mythweavers/llm` — typecheck passes
- `@mythweavers/backend` — `tsc` build passes
- `@mythweavers/story-editor` — typecheck passes
- Tests: same results as before (2 pass, 3 pre-existing SolidJS store failures)

## Remaining Items (for future sessions)

- The legacy `anthropicClient.ts` is still used by `templateAI.ts`, `copyPreviewStore.ts`, and `StoryNavigation.tsx` for Anthropic-specific token counting. Could be consolidated if needed.
- The `analysisClient.refactored.ts.bak` and `useOllama.refactored.ts.bak` files are dead code that could be deleted.
- Database migrations for the billing/admin system still need to be run (see bottom of this file for commands).

### To Activate Billing/Admin (migrations needed)
```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name add_llm_provider_registry
pnpm prisma migrate dev --name add_user_balance_and_billing
npx tsx prisma/seed-llm-providers.ts
# Set ADMIN_EMAILS=your@email.com in .env.local
```

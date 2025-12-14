# Migration Plan for Unified LLM Client

## Files to Replace

### 1. Replace old client files with new unified implementation
- **Delete:** 
  - `src/utils/ollamaClient.ts`
  - `src/utils/anthropicClient.ts`
  - `src/utils/openrouterClient.ts`
  
- **Keep new files:**
  - `src/utils/llm/` directory with all new client implementations
  - `src/types/llm.ts` with unified types

### 2. Update imports in existing files
- `src/hooks/useOllama.ts` → Replace with `src/hooks/useOllama.refactored.ts`
- `src/stores/modelsStore.ts` → Replace with `src/stores/modelsStore.refactored.ts`

### 3. Update other files that import old clients
Need to check and update imports in:
- `src/utils/analysisClient.ts`
- Any other files that directly import the old client files

## Benefits of Migration

1. **Reduced code duplication** - Common logic in base class
2. **Consistent interface** - All providers implement same interface
3. **Better error handling** - Centralized error handling in base class
4. **Easier to add new providers** - Just extend base class
5. **Type safety** - Single source of truth for types

## Testing Checklist

Before completing migration:
- [ ] Ollama provider works (list models, generate text)
- [ ] Anthropic provider works (list models, generate text, caching)
- [ ] OpenRouter provider works (list models, generate text)
- [ ] Model switching works smoothly
- [ ] Error handling works (wrong API key, service down, etc.)
- [ ] Token counting and caching still works
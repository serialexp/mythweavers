# Import Update Guide

## Types to Update

### From `../types` or `./types`:
- Change to `../types/core` or `./types/core` for:
  - Message
  - SceneAnalysis
  - Model
  - StorySetting
  - Character
  - ContextItem

### From `../utils/apiClient`:
- ApiStory, ApiStoryMetadata → `../types/api`

### From `../stores/*Store`:
- CurrentStory → `../types/store`
- CacheEntry → `../types/store`
- PendingEntity, PendingEntityBatch → `../types/store`
- GlobalOperation, GlobalOperationType → `../types/store`

### From `../utils/storyManager`:
- SavedStory, StoryMetadata → `../types/store`

### From `../utils/*Client`:
- ChatMessage, GenerateOptions, GenerateResponse → `../types/llm`

### From `../utils/smartContext`:
- InputAnalysis, StoryBeatContext, KnownEntities → `../types/utils`

## Files to Update
1. All component files importing from types
2. All store files
3. All utility files
4. All hook files
# MythWeavers Write Frontend Audit

Audit date: 2026-07-18

Scope: `apps/mythweavers-story-editor`, with emphasis on persistence, API boundaries, asynchronous state, reachable UI paths, and test coverage.

## Findings

### 1. Critical: failed generated-SDK saves can be reported as successful

The generated API client returns an `{ error }` result for non-2xx responses unless `throwOnError` is enabled. The frontend client configuration does not enable it, while many `saveService` operations await SDK calls without inspecting their return value. The queue consequently logs those operations as complete, removes them, and allows the UI to leave its saving state even when the backend rejected the write.

This can affect node, map, landmark, character, context-item, and message persistence. Authentication failures, conflicts, and server errors may receive neither retry handling nor a user-visible error.

### 2. High: active workflows still depend on the deliberately obsolete API client

`src/utils/apiClient.ts` identifies itself as obsolete and deliberately sends requests to port 3001. It is nevertheless used by full/manual/force story saves, message refresh, story synchronization, password recovery, context states, fleet movements, and Story Manager actions.

These calls bypass the configured unified backend and normally fail outside the retired legacy-backend setup. The legacy client should be removed and supported workflows should use the generated SDK exclusively.

### 3. High: local outline-only stories are not saved

Local full-story persistence returns early when a story contains no messages, although nodes and snowflake summaries are independent parts of the save payload. A user can create a local story, build an outline without generating prose, reload, and lose the outline.

Local saves are also fire-and-forget. A change arriving while a full save is in progress is skipped, with no dirty flag scheduling a follow-up save.

### 4. Medium: snowflake edits can disappear during navigation

The node-summary and story-concept inputs debounce writes for 400 ms. Their cleanup handlers cancel pending timers without flushing the current draft. Typing and immediately leaving the snowflake view therefore discards the latest input.

Node title persistence has a second one-second debounce in `saveService`, which is not flushed on page exit.

### 5. Medium: optimistic rollback runs before retry decisions

The save queue invokes `onOperationFailed` before deciding whether a transient failure should be retried. Landmark, fleet, and hyperlane insert failures are immediately removed from local state. A later successful retry can leave a server-side entity that is no longer represented in the UI.

### 6. Medium: map image upload is hardcoded to localhost

Map creation uploads image data to `http://localhost:3201/my/files`. In a remote deployment this contacts the visitor's machine. Upload failure is only logged, after which the map is still created without its image.

### 7. Medium: Episode Viewer depends on the legacy backend

Episode Viewer requests `/api/episodes` and related media URLs. Those routes exist only in `apps/story-legacy-backend`, while the feature remains exposed from the active Story Header.

### 8. Low: production logging exposes manuscript content

The landing page logs complete locally stored stories and the first message to the browser console. This can expose private manuscript text through shared-device logs and support captures.

## Validation and coverage notes

- TypeScript checking passed at audit time.
- All 65 existing frontend tests passed at audit time.
- The test run repeatedly logged `indexedDB is not defined` and Solid computations created outside a reactive root.
- Save-service tests cover queue merging with queue execution mocked out. They do not cover HTTP failures, retries, local-save races, debounce flushing, or the generated client's error-return behavior.

## Suggested remediation order

1. Make all generated-SDK errors propagate into save queue handling.
2. Remove the legacy API client and migrate its remaining consumers.
3. Correct local-story persistence and concurrency.
4. Flush debounced snowflake edits on cleanup/page exit.
5. Correct retry rollback ordering.
6. Remove remaining hardcoded/manual backend calls.
7. Migrate or remove Episode Viewer.
8. Reduce production content logging and strengthen failure-path tests.

## Resolution log

- 2026-07-18: Finding 1 fixed by enabling generated-client rejection for non-2xx responses, preserving HTTP status in `ApiRequestError`, reporting non-retryable client failures through the save UI, and adding regression tests.
- 2026-07-18: Finding 2 fixed by deleting `src/utils/apiClient.ts` and migrating its supported consumers to the generated SDK. Obsolete password-reset UI was removed because the unified backend has no reset-token API. Legacy per-message context-state persistence was removed because it had no callers or unified data model. Pawn movement operations now fail explicitly until the unified API exposes movement routes, instead of silently contacting the retired backend.
- 2026-07-19: Finding 3 fixed by saving local stories even when they contain no messages and serializing/coalescing local writes so changes made during an IndexedDB write receive a follow-up snapshot.
- 2026-07-19: Finding 4 fixed by committing snowflake drafts during component cleanup, flushing the save-service debounce, and flushing pending saves when the page is hidden or unloaded.
- 2026-07-19: Finding 5 fixed by invoking optimistic rollback only after a failure is terminal. Successful retries now leave local entities intact, with regression coverage for retry success and terminal client errors.
- 2026-07-19: Finding 6 fixed by uploading map images through the configured API URL and aborting map creation when the upload fails or returns no file ID.
- 2026-07-19: Finding 7 fixed by removing Episode Viewer from the active application because its episode routes have no unified-backend equivalent.
- 2026-07-19: Finding 8 fixed by removing landing-page logs of complete local stories and message content.

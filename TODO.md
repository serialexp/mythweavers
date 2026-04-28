# TODO

## Story-editor UX

- **`BackgroundMessage` Replace button still uses a native file input** (`apps/mythweavers-story-editor/src/components/BackgroundMessage.tsx` ~line 40). `InsertBackgroundButton` now goes through `BackgroundPickerModal` (FilePicker — library + upload). The inline Replace flow on existing background messages should be migrated the same way so authors can reuse library images instead of re-uploading.

## Open PRs / branches in flight

- **Royal Road publishing port** — branch `feat/royal-road-publishing` pushed to `origin`, ready to open PR at https://github.com/serialexp/mythweavers/pull/new/feat/royal-road-publishing. Five commits: schema+crypto+account routes, Playwright serializer+client, worker+remaining routes, regenerated OpenAPI clients, editor UI MVP (publishing panel). Before deploy: generate `ROYAL_ROAD_ENC_KEY` with `openssl rand -base64 32`, install Firefox in the worker container (`npx playwright install firefox --with-deps`), set `ROYAL_ROAD_WORKER_ENABLED=true`. Deferred to follow-ups: chapter link/unlink UI, manual sync button, live status polling. Pre-existing unrelated typecheck errors in `src/pages/adventure/*` + `src/stores/adventureStore.ts` from commit `decbfa8` were flagged but not fixed. If Bart asks "what was that Royal Road thing Claude did?" — this is it.

## Publishing feature — deferred items

Tracked while implementing the `publishedAt` + daily digest flow (see `CURRENT_TASK.md`).

- **Reader-side bookshelf UI**: follow/unfollow buttons on story pages, a "Following" list page in the Astro reader. Backend endpoints (`Phase 6`) exist; UI is not built.
- **Per-user timezone for digest**: v1 runs at a fixed UTC time. Add `User.timezone` + per-user scheduling when users complain.
- **Web push / in-app notifications**: email-only for v1.
- **Royal Road port**: legacy implementation in `apps/writer-legacy-backend/src/procedures/publish-to-royal-road.ts` is untouched. Port as a separate task if/when needed.
- **Migration 2 — drop legacy publish fields**: once all code is cut over to `publishedAt`, schedule a migration that drops `Story.published` and `Chapter.publishedOn`. Also remove dead `publishToRoyalRoad` and `royalRoadId` fields from `apps/shared/src/schema.ts`.
- **Maintain `Story.firstChapterReleasedAt` / `lastChapterReleasedAt`**: these fields exist on `Story` but nothing writes them. Publish endpoints (`Phase 2`) should start keeping them in sync — note if they aren't done there, do them afterward.

## Shared SolidJS component package for MythWeavers apps

The MythWeavers apps (admin, reading-frontend-astro, story-editor) all use SolidJS + `@mythweavers/ui` and share common app-level components like login forms. Currently these are duplicated across apps.

We need a proper package (e.g. `@mythweavers/solid-app-components` or similar) to house composed SolidJS components that are shared between multiple apps but are too high-level/business-specific for the `@mythweavers/ui` design system package. The existing `@mythweavers/shared` package is pure data types/utilities with no UI framework dependency, so it's not the right place either.

Candidates for extraction:
- **LoginForm** — currently duplicated in story-editor, reading-frontend-astro, and admin (simplified version)
- Potentially other auth-related UI (registration form, forgot password)

## AI rewrite (selection-based) — deferred extras

The basics — Rewrite menu in InlineMenu with 5 presets (grammar, show-don't-tell, sensory, style-polish, perspective→1st/2nd/3rd) and an inline accept/reject diff popover — landed in `packages/ui/src/components/Editor/solid-editor/InlineMenu.tsx` and `apps/mythweavers-story-editor/src/components/SceneEditorWrapper.tsx`. Expansion ideas (do not block the v1):

- **Rich context injection in prompts**: today the prompt only has the selected text + containing paragraph. Pull POV character, active characters, story tone, and previous/next paragraphs from `editorScene` and pass them to `handleRewrite` so the model can match voice/style.
- **Multi-paragraph selections**: v1 disables the Rewrite button when the selection crosses paragraph boundaries (single-paragraph only). Lift this once we have a clear UX for multi-paragraph diff display.
- **User-defined custom presets**: let users add their own preset prompts via a settings UI. Store on the user, ship sensible defaults.
- **Streaming diff display**: today the popover only shows after the full response arrives. Stream chunks into the diff popover so long rewrites don't feel frozen.
- **Word-level diff**: the popover shows the original strikethrough above the rewrite. A proper word-level diff (highlight only changed spans) would be easier to scan — see existing `diffDelete` / `diffInsert` styles in `scene-editor.css.ts` for reference.
- **Rewrite revision tracking**: persist accepted rewrites as a `versionType: 'rewrite'` revision so users can see/revert AI edits separately from their own typing.
- **Cancel in-flight rewrite**: if the user starts a rewrite and changes their mind, we currently just block on `isRewriting`. Add an abort button.
- **Preset model overrides**: today all rewrites resolve through the `'rewrite:selection'` call type → `rewriting` category. Per-preset overrides (e.g. always use a small/cheap model for `grammar`) would save tokens.

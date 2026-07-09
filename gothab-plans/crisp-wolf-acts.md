# Physical-state tracker for adventure mode

## Goal

A new story-settings toggle that keeps a concise ledger of the **physical
state** of the protagonist and the named characters in the scene — injuries,
conditions (exhausted / poisoned / soaked / frightened), equipment, position
(prone / bound / unarmed), etc. — and injects it into every narrative pass as a
reminder. The problem Bart described: the LLM forgets earlier physical events
("her broken wrist", "he lost his sword three turns ago") because they aren't in
its training data, so it needs an explicit, maintained reminder.

It should be "a very short and simple call."

---

## Design decision (Bart to choose)

There are two architecturally clean ways to do this. I'm not picking one —
presenting both so you can judge.

### Option A — Standalone "conditions" blob (analogous to `storyline`)

A single persisted markdown string, `conditions`, maintained by its own
dedicated per-turn LLM call (`adventure-conditions`, analysis category → cheap
model). Mirrors the existing **synthesis pass** pattern: a background call that
takes the current blob + recent narrative + protagonist + (optional) character
roster and returns an updated blob. Injected into the five narrative builders
exactly where `appendLiveWorldState` is already called, via a new
`appendConditions()` helper, gated on the new toggle.

- **Protagonist is first-class.** The protagonist is configured via
  `protagonistInput` / the `PROTAGONIST:` section of the setting and is *not*
  part of the `characters` roster — so a standalone tracker that owns the
  protagonist is a better fit than wiring it into the roster.
- **Decoupled from living world.** Living world can be off (many short/test
  adventures turn it off); conditions tracking still works for the protagonist
  + whoever is on-page. It's its own toggle, independently togglyable.
- **"Very short and simple call"** — one focused call, small output, no
  tool-call plumbing. Matches what you asked for.
- **Cost:** one extra analysis-category call per turn (same order as the
  synthesis pass).

Sample blob the call maintains:
```
- Maren (protagonist): left wrist broken & splinted (throbbing); soaked
  through; exhausted; unarmed.
- Capt. Voss: bleeding from a gash above the right eye; winded; cutlass drawn.
- The hound: limping on its right foreleg.
```
Injected as: `[CHARACTER CONDITIONS — physical state as of this turn. The
narrative MUST respect these; a character cannot use an arm that is broken,
cannot produce an item they do not have, cannot sprint if they are exhausted.]`

### Option B — Extend `CharacterCard` with a `condition` field, patched by the analysis pass

Add a `condition` field to `CharacterCard`, add a `patch_character` argument for
it (or a new tool), and have the existing analysis pass maintain it. Render it
in the character-roster line inside `formatLiveWorldState`.

- **Reuses existing tool-call machinery** — no new call type, no new pass.
- **Coupled to living world:** only runs when `livingWorldEnabled` is on, and
  the **protagonist is not in the roster** (the most important physical-state
  subject) unless separately added. So it would either miss the protagonist or
  require also adding the protagonist as a character — which changes the living-
  world model's behaviour.
- **Heavier** — the analysis pass already does a lot (dispositions, plot points,
  agenda); piling physical state on top risks it being maintained less
  reliably than a focused call.

**Default below assumes Option A.** Say the word if you'd rather take B.

---

## Implementation (Option A)

### 1. Types & persistence — `src/hooks/useAdventurePersistence.ts`
- Add to `PersistedState`:
  ```ts
  /** When true, a dedicated per-turn call maintains a physical-state ledger. */
  conditionTrackingEnabled?: boolean
  /** Model-maintained ledger of physical state for the protagonist + on-page
   *  named characters. Regenerated each turn by the conditions pass. */
  conditions?: string
  ```

### 2. Store — `src/stores/adventureStore.ts`
- `AdventureState`: add `conditionTrackingEnabled: boolean` (default `false`) and
  `conditions: string` (default `''`). Also `isTrackingConditions: boolean`
  (transient spinner flag, like `isAnalyzing`).
- Initial state, `reset()`, and `initialize()`: thread the two new persisted
  fields through (mirror `storyline` / `isSynthesizing`).
- `buildSnapshot()`: include `conditionTrackingEnabled` and `conditions`.
- Getters + setters: `setConditionTrackingEnabled`, `get/set conditions`,
  `get/setIsTrackingConditions`.

### 3. Settings toggle — `src/components/AdventureSettings.tsx` + `AdventureSettingsModal.tsx`
- Add `conditionTrackingEnabled` to `AdventureSettingsValues`,
  `ADVENTURE_SETTING_DEFAULTS` (default `false`), and the `ADVENTURE_SETTINGS`
  descriptor list with label + hint.
- Add it to the `SETTERS` map and `values` object in `AdventureSettingsModal`.

### 4. Call type — `src/utils/llm/resolveModel.ts`
- Add `'adventure-conditions': 'analysis'` to `CALL_TYPE_CATEGORY` (cheap model,
  small output).

### 5. Prompt builder + injection — `src/pages/adventure/prompts.ts`
- New `buildConditionsMessages(recentNarrative, currentConditions, protagonist,
  liveWorldState?, { settingDescription, worldBible })` — returns messages
  asking for an *updated* conditions blob (drop healed/resolved states, add new
  ones, keep carrying-forward ones). Instruction emphasises: physical-only,
  concise, one line per character, protagonist first, no scene description, no
  plot/relationships (that's the roster's job).
- New `appendConditions(messages, conditions?)` helper that, if the blob is
  non-empty, pushes a `[CHARACTER CONDITIONS …]` system message.
- Thread a `conditions?: string` param through the five narrative builders and
  call `appendConditions` right after each `appendLiveWorldState`:
  `buildResolutionMessages`, `buildWorldStepMessages`, `buildDirectorMessages`,
  `buildRevisionMessages`, `buildPartnerActionMessages`.

### 6. Engine — `src/pages/adventure/useAdventureEngine.ts`
- New `conditionsForPrompt()`: returns `adventureStore.conditions` when the
  toggle is on, else `undefined` (mirrors `liveWorldStateForPrompt()`).
- New `runConditionsPass()` — mirrors `runSynthesisPass()`: gated on the toggle
  + not-already-running + turns>0; resolves `adventure-conditions`; feeds
  recent narrative + current blob + protagonist; stores result on
  `adventureStore.conditions`; persists on change. Non-fatal on error (keeps the
  previous blob).
- Fire `runConditionsPass()` after each finalized turn, next to the
  `runAnalysisPass()` call (≈ line 646–647).
- Pass `conditionsForPrompt()` into every `build*Messages(...)` call site that
  already passes `liveWorldState`.
- (Optional, nice-to-have) a manual "re-track conditions" entry on the engine,
  like `runAnalysisPass`/`runSynthesisPass`, surfaced from the World panel.

### 7. UI surface (minimal)
- The toggle (step 3) is the core ask. The maintained blob is visible in the
  World panel next to the storyline, with an edit affordance, so you can correct
  the model the same way you can edit the storyline. (Kept minimal — defer a
  richer per-character breakdown unless you want it.)

---

## Notes
- `TODO.md` flags pre-existing typecheck errors in `src/pages/adventure/*` +
  `adventureStore.ts` (commit `decbfa8`). I'll confirm they're resolved or leave
  them untouched (not mine to silently fix) — flagging per Rule #0.5.
- No backend schema change needed: adventures persist `data` as opaque JSON, so
  the new fields ride along automatically.
- No OpenAPI client regen needed (client-side-only state).

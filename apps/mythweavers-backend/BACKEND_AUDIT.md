# MythWeavers Backend Audit

Audit date: 2026-07-19

Scope: `apps/mythweavers-backend`, with emphasis on authorization boundaries, authentication, billing, file access, resource consumption, transactional consistency, and production/test parity.

## Findings

### 1. Critical: bulk write endpoints can mutate or move another user's content

The node reorder and bulk-update endpoints verify that the caller owns the `storyId` in the URL, but never verify that each submitted `nodeId` or `parentId` belongs to that story. They then update books, arcs, chapters, and scenes by globally unique ID alone (`src/routes/my/stories.ts:1989-2063`, `2128-2222`). An authenticated user can therefore submit one of their own story IDs while targeting node IDs from another user's story. The bulk-update endpoint permits changing names, all three summaries, status, POV/context data, and other scene fields; the reorder endpoint can also re-parent foreign arcs, chapters, or scenes.

The message paths repeat the same boundary error. A normal message patch verifies ownership of the message's current story but accepts an arbitrary destination `nodeId` without validating that scene (`src/routes/my/messages.ts:582-654`). The bulk message reorder endpoint verifies only the URL story, then updates every supplied message and destination scene by ID (`src/routes/my/messages.ts:772-806`). This can move a foreign message into an attacker-owned scene, after which the attacker's account passes the ordinary ownership checks for reading, editing, or deleting it.

These IDs are not necessarily secret: published story responses expose hierarchy and message IDs. All bulk operations should first resolve the complete submitted set, prove both resources and destination parents belong to the authenticated story, reject type mismatches and null parents, and only then perform the transaction. Regression tests need two users and deliberately mixed IDs.

### 2. High: local private uploads have an unauthenticated static-file bypass

The application registers `UPLOAD_DIR` directly under `/files/` with `@fastify/static` (`src/index.ts:143-150`). Separately, `/my/files/*` performs the intended database lookup and denies anonymous or non-owner access to private files. Local uploads are stored inside that same directory as `{ownerId}/{year}/{month}/{filename-hash}`.

Consequently, `/files/{ownerId}/{year}/{month}/{filename-hash}` serves the bytes without consulting the `File.visibility` field or authenticating the requester. The protected `/my/files/...` URL is not a security boundary while the parallel static URL exists. This affects local-storage deployments and development/staging environments; R2-backed private objects use a different path. The raw static registration should be removed or restricted to a genuinely public directory, leaving the controlled file route as the only way to read private local objects.

### 3. High: Stripe top-up idempotency is race-prone and not enforced by the database

The webhook searches `BalanceLedger.description` for the PaymentIntent ID before starting the credit transaction (`src/routes/webhooks/stripe.ts:71-96`). There is no unique PaymentIntent/event column or constraint. Two deliveries processed concurrently can both observe no ledger row and both increment the user's balance.

Stripe retries and duplicate delivery are normal webhook behavior, so idempotency should be represented as structured data with a unique constraint and claimed inside the same transaction as the balance update. The credited amount should also be derived and cross-checked against Stripe's integer payment amount/currency rather than treating a decimal metadata string as the financial source of truth.

### 4. High: the paid LLM proxy can spend far beyond the available balance

Generation admission checks only whether the request-start balance is greater than zero (`src/routes/my/llm.ts:204-208`). Request validation places no upper bound on `max_tokens`, `thinking_budget`, message count, or message content size (`src/routes/my/llm.ts:49-60`), and multiple generations for the same user may run concurrently. Cost is calculated and debited only after the upstream stream completes (`src/routes/my/llm.ts:315-355`).

A nearly empty account can therefore initiate one or many expensive requests and drive the balance substantially negative, not merely slightly negative. If recording the usage transaction fails, the upstream result has already been delivered and the code only logs the error (`src/routes/my/llm.ts:356-359`), making the generation free. Admission needs bounded request sizes plus an atomic reservation or enforced credit limit based on worst-case cost; final settlement can refund unused reserved credit.

### 5. High: credentialed CORS reflects every requesting origin in production

The server's CORS callback accepts every origin while enabling credentials, despite the comment describing a development-only localhost policy (`src/index.ts:113-122`). There is no environment condition or allowlist. `SameSite=Lax` limits cross-site cookie use, but it does not protect against a hostile same-site sibling origin when cookies are shared across the configured root domain, and the permissive policy also unnecessarily exposes bearer-authenticated API responses to any origin that obtains a token.

Production should use an explicit origin allowlist for the editor, reader, admin, and intentional local development origins. State-changing cookie-authenticated requests should also have a deliberate CSRF policy rather than relying on CORS and cookie defaults incidentally.

### 6. Medium: authenticated API use silently changes the chosen session lifetime

Login creates either a three-day or thirty-day session and states that expiry is fixed (`src/routes/auth/index.ts:212-232`). However, every route that calls `requireAuth` goes through `getUserFromSession`, which rewrites the database expiry to `now + 3 days` (`src/lib/auth.ts:82-87`). The first authenticated API request therefore shortens a new "remember me" session from thirty days to roughly three, while normal sessions become sliding three-day sessions. `/auth/session` follows the documented fixed-expiry behavior, so the outcome also depends on which endpoint the frontend happens to call.

The session record needs to retain its selected duration if rolling expiry is intended, or authenticated middleware should stop rewriting `expiresAt` if fixed expiry is intended. Tests should cover time advancement for both login modes through `/auth/session` and an ordinary `/my` route.

### 7. Medium: the registered legacy device page interpolates unescaped HTML

The backend still registers a server-rendered `/device` page even though the editor now owns the designed device UI. Its template inserts `error`, `success`, `username`, `userCode`, and `loginUrl` directly into HTML and attribute contexts (`src/routes/device/index.ts:173-208`). In particular, an authenticated user visiting a crafted `/device?code=...` URL receives the query value unescaped in an `<input value="...">` attribute (`src/routes/device/index.ts:186-195`). There is no Content Security Policy configured to limit the result.

This is a reflected-XSS path on the API origin, and usernames containing markup are a second stored interpolation path. The obsolete page should preferably be removed now that authorization is handled by the editor; if retained, it needs context-appropriate escaping, a restrictive CSP, and focused security tests.

### 8. Medium: story ZIP import/export can exhaust process memory and leak storage

Export reads every referenced file fully into memory, retains all file buffers simultaneously, then also accumulates the entire ZIP in a second set of buffers before sending it (`src/routes/my/export-story.ts:820-867`). A story can reference many individually valid 10 MB uploads, so one export can require multiples of the story's total asset size and terminate the backend process.

Import first buffers the complete upload, then opens ZIP contents and calls `.buffer()` on manifest, story, and each imported file (`src/routes/my/export-story.ts:912-1029`). The multipart compressed-size limit does not constrain decompressed bytes, file count, hierarchy count, or ZIP compression ratio. Storage writes occur inside the logical import but outside PostgreSQL's rollback boundary; if a later database operation fails, already written local/R2 objects remain unreachable.

Export should stream archive entries directly to the response. Import needs limits on entry count, per-entry and total expanded bytes, validated story shape/counts before database work, and cleanup of storage objects when the database transaction fails.

### 9. Medium: image generation can leave untracked objects after deduplication or DB failure

Generated image bytes are saved before the database transaction (`src/routes/my/images.ts:369-390`). If the SHA already exists, the transaction reuses the existing `File` row but never deletes the newly saved object (`src/routes/my/images.ts:391-412`). A transaction failure after storage succeeds has the same leak. The ordinary upload route already has the needed pattern: delete the redundant object when deduplication wins.

Track whether the stored object was adopted by a new `File` row and delete it on deduplication or any later failure. A storage cleanup job is useful as a backstop but should not be the normal consistency mechanism.

### 10. Low: the integration-test server does not represent the production server

`tests/helpers.ts` constructs a second Fastify application manually. It omits form-body parsing, static file serving, WebSockets, OAuth/device routes, PDF export, the Stripe webhook, and production lifecycle/error behavior (`tests/helpers.ts:73-186`). Its CORS configuration also differs. As a result, several of the highest-risk boundaries above cannot be exercised through the existing integration harness, and every new production registration must be duplicated by hand.

Extract a shared application factory used by both `src/index.ts` and tests, with only server listening and long-running workers excluded in tests. External services can be injected or mocked while retaining identical registration, hooks, parsers, and security configuration.

## Validation and coverage notes

- `pnpm --filter @mythweavers/backend build` passes after remediation.
- The focused regression suite passes: 126 tests, 0 failures.
- The complete backend suite passes: 602 tests across 40 files, 0 failures.
- New regressions cover mixed-owner bulk mutations, foreign message destinations, direct `/files/` access, fixed session expiry, untrusted cookie origins, concurrent Stripe delivery, concurrent LLM reservations, ZIP expansion limits, and generated-image deduplication cleanup.
- The Prisma schema now includes the Stripe idempotency constraint. A development migration must still be generated interactively with `pnpm --filter @mythweavers/backend prisma:migrate --name add_balance_ledger_external_id`; only the disposable test database was synchronized during remediation.
- The audit intentionally excludes legacy backend applications except where active code still exposes a legacy path.

## Resolution log

All ten findings were addressed on 2026-07-19:

1. Bulk node and message mutations now validate every source and destination against the authenticated story before updating anything.
2. The unauthenticated `/files/` static registration was removed; private files are served only by the authorization-aware route.
3. Stripe top-ups use the PaymentIntent amount and currency, and claim a unique structured external ID inside the credit transaction.
4. LLM requests have bounded inputs and outputs, with an atomic worst-case credit reservation followed by actual-cost settlement and refund.
5. Credentialed CORS uses an explicit configurable allowlist, and cookie-authenticated mutations reject untrusted origins.
6. Ordinary authenticated requests no longer rewrite session expiry, preserving the duration selected at login.
7. The obsolete backend-rendered device page and route were removed in favor of the editor's device authorization page.
8. Archive import enforces entry, expanded-size, and entity-count limits and cleans up stored objects on rollback. Export uses a bounded temporary archive instead of retaining all source files and ZIP output in memory.
9. Generated-image deduplication and database failures now remove storage objects that were not adopted by a `File` row.
10. Production and integration tests now share one application-route registration function, including OAuth, PDF, WebSocket, adventure, and webhook routes.

## Suggested remediation order

1. Close the cross-story bulk mutation and re-parenting paths; add two-user regression tests.
2. Remove the unauthenticated local static upload route.
3. Make Stripe top-ups transactionally idempotent with a database constraint.
4. Add bounded, atomic credit reservation for server-funded LLM calls.
5. Restrict credentialed CORS and define the cookie/CSRF policy.
6. Make session expiry semantics consistent.
7. Remove or secure the legacy backend device page.
8. Stream and limit story archives, with storage rollback cleanup.
9. Clean up unadopted generated image objects.
10. Consolidate production and test server construction.

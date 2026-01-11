# Current Task: OAuth Device Flow for Claude Artifacts

## Status: Implementation Complete, Needs Migration

Claude artifacts need to authenticate with the MythWeavers API. Since they run on `claude.site`, they can't use session cookies. We implemented OAuth Device Authorization Flow (RFC 8628).

## What Was Done

### Database Schema
Added two new models to `apps/mythweavers-backend/prisma/schema.prisma`:

```prisma
model AccessToken {
  id        String    @id @default(cuid())
  userId    Int
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String    @unique // mw_xxxxxxxxxxxx
  name      String             // "Claude Artifact" or user-defined
  lastUsed  DateTime?
  expiresAt DateTime?          // null = never expires
  createdAt DateTime  @default(now())
}

model DeviceCode {
  id         String   @id @default(cuid())
  deviceCode String   @unique // Random string for polling
  userCode   String   @unique // Human-friendly ABCD-1234
  userId     Int?             // Set when user approves
  expiresAt  DateTime         // Short-lived: 15 minutes
  approved   Boolean  @default(false)
  createdAt  DateTime @default(now())
}
```

### Auth Middleware Update
Updated `apps/mythweavers-backend/src/lib/auth.ts` to check Bearer tokens before session cookies:
- Checks `Authorization: Bearer mw_xxx` header first
- Falls back to session cookie if no Bearer token
- Updates `lastUsed` timestamp on token use (fire-and-forget)
- Automatically deletes expired tokens

### OAuth Routes
Created `apps/mythweavers-backend/src/routes/oauth/index.ts`:
- `POST /oauth/device` - Start device flow, returns `device_code`, `user_code`, `verification_uri`
- `POST /oauth/token` - Poll for access token (returns `authorization_pending` until approved)
- `POST /oauth/approve` - API endpoint to approve a device code (requires auth)

### Device Verification Page
Created `apps/mythweavers-backend/src/routes/device/index.ts`:
- `GET /device` - Beautiful HTML page with form to enter user code
- `POST /device` - Form handler that approves the device code
- Handles login redirect if user not authenticated
- Shows success/error messages

### Package Updates
- Added `@fastify/formbody` to `package.json` for form handling
- Registered routes in `src/index.ts`

## How It Works

1. **Artifact requests device code:**
   ```javascript
   const response = await fetch('https://api.mythweavers.io/oauth/device', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({})
   })
   const { device_code, user_code, verification_uri } = await response.json()
   // Shows: "Go to https://api.mythweavers.io/device and enter code ABCD-1234"
   ```

2. **User opens verification URL:**
   - Goes to `https://api.mythweavers.io/device`
   - Logs in if needed (redirects to editor login, then back)
   - Enters the code (e.g., `ABCD-1234`)
   - Clicks "Authorize Device"

3. **Artifact polls for token:**
   ```javascript
   const tokenResponse = await fetch('https://api.mythweavers.io/oauth/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
       device_code: device_code
     })
   })

   // While pending: { error: 'authorization_pending' }
   // When approved: { access_token: 'mw_xxx', token_type: 'Bearer', expires_in: 5184000 }
   ```

4. **Artifact uses token:**
   ```javascript
   const stories = await fetch('https://api.mythweavers.io/my/stories', {
     headers: { 'Authorization': `Bearer ${access_token}` }
   })
   ```

## Token Configuration
- **Device codes:** Expire in 15 minutes
- **Access tokens:** Expire in 60 days
- **Polling interval:** 5 seconds recommended

## Required Actions

### 1. Run pnpm install
```bash
pnpm install
```

### 2. Run Prisma Migration
```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name add_access_token_and_device_code
```

### 3. Test the flow
1. Start the backend: `pnpm dev:server`
2. Visit `http://localhost:3201/device` to see the page
3. Test the OAuth endpoints via the API docs at `http://localhost:3201/docs`

## Future Enhancements

### API Key Management UI
The `AccessToken` model can also be used for manually-created API keys:
- `expiresAt: null` = never expires
- Add routes: `GET /my/api-keys`, `POST /my/api-keys`, `DELETE /my/api-keys/:id`
- Add UI in the editor settings to manage tokens

### Considerations
- Could add `scope` field to AccessToken for fine-grained permissions
- Could add rate limiting per token
- Could add token rotation (refresh tokens) if needed

## Adventure Storage API

Added a simple JSON blob storage for artifact adventures:

**Database:**
```prisma
model Adventure {
  id        String   @id @default(cuid())
  userId    Int
  user      User     @relation(...)
  name      String   @default("Untitled Adventure")
  data      Json     // Full artifact state as JSON blob
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**API Endpoints:**
- `GET /my/adventures` - List user's adventures (name, id, timestamps)
- `GET /my/adventures/:id` - Get full adventure with data
- `POST /my/adventures` - Create new adventure
- `PUT /my/adventures/:id` - Update adventure
- `DELETE /my/adventures/:id` - Delete adventure

## Claude Writer Artifact Integration

The `apps/claude-writer/claude-writer-artifact.jsx` has been updated to support MythWeavers authentication AND adventure syncing:

**Auth Features:**
- "Connect MythWeavers" button in the header
- Device flow auth modal showing the user code
- Auto-polling for token after user authorizes
- Connection status indicator (green dot + username when connected)
- Token persistence in localStorage
- Disconnect functionality

**Sync Features:**
- Auto-save to MythWeavers when connected (2s debounce)
- "My Adventures" button to browse saved adventures
- Load any saved adventure from the cloud
- Delete adventures from the cloud
- Sync status indicator (Syncing.../Synced/Sync failed)
- Current adventure highlighted in list

**How it works:**
1. User clicks "Connect MythWeavers"
2. Modal shows: "Go to api.mythweavers.io/device and enter code ABCD-1234"
3. User opens link, logs in, enters code
4. Modal auto-detects authorization and closes
5. Adventures auto-sync to MythWeavers as user plays
6. User can browse and load previous adventures via "My Adventures" button

## Files Changed

New files:
- `apps/mythweavers-backend/src/routes/oauth/index.ts` - OAuth device flow endpoints
- `apps/mythweavers-backend/src/routes/device/index.ts` - Device verification HTML page
- `apps/mythweavers-backend/src/routes/my/adventures.ts` - Adventure CRUD endpoints

Modified files:
- `apps/mythweavers-backend/prisma/schema.prisma` - Added AccessToken, DeviceCode, Adventure models
- `apps/mythweavers-backend/src/lib/auth.ts` - Check Bearer tokens before session cookies
- `apps/mythweavers-backend/src/index.ts` - Register new routes, add formbody
- `apps/mythweavers-backend/package.json` - Added @fastify/formbody
- `apps/claude-writer/claude-writer-artifact.jsx` - Full MythWeavers integration (auth + sync)

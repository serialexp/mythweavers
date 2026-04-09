# Current Task: Persist AI Settings on Backend User Entity (with encrypted secrets)

## Status: Code complete — needs migration

### Bart needs to run:
```bash
cd apps/mythweavers-backend
pnpm prisma migrate dev --name add_user_preferences
```

## What was done

### Prisma Schema
- Added `preferences Json?` to User model

### Backend
- `GET /my/preferences` + `PUT /my/preferences` — user preferences CRUD
- Session response includes `preferences` field
- `preferencesSchema` includes `encryptedSecrets` (salt + iv + ciphertext)

### Frontend — Encryption (`src/lib/crypto.ts`)
- Web Crypto API: PBKDF2 (600k iterations, SHA-256) for key derivation
- AES-GCM-256 for encryption/decryption
- All secrets bundled into one encrypted blob before backend sync
- Server never sees plaintext API keys

### Frontend — Settings sync (`settingsStore.ts`)
- Non-secret keys synced in plaintext: provider, model, maxTokens, thinkingBudget, contextSize, cloudflareEndpoint, categoryOverrides
- Custom providers synced WITHOUT apiKey (stripped before sending)
- Secret keys encrypted into `encryptedSecrets` blob: openrouterApiKey, anthropicApiKey, openaiApiKey, cloudflareApiKey, custom provider API keys
- `loadFromBackend()` handles encrypted secrets, legacy plaintext, and missing keys
- `needsDecryption` signal triggers the unlock dialog

### Frontend — UI
- `PasswordForEncryptionDialog.tsx` — dual-mode modal (decrypt/encrypt)
- `App.tsx` — shows decrypt dialog when backend has encrypted secrets but device doesn't have keys
- `ProviderModelSelector.tsx` (ApiKeys) — shows "Encrypt & Sync Keys" banner when authenticated with keys but no encryption key in memory

### Flow
1. User sets API keys → saved to localStorage immediately
2. If authenticated + has encryption key → encrypt + sync to backend
3. If authenticated + no encryption key → show "Encrypt & Sync Keys" prompt
4. On new device → session loads encrypted blob → show "Unlock API Keys" dialog
5. User enters password → PBKDF2 derives key → AES-GCM decrypts → keys populated

### Note on duplication
- SETTING_KNOBS and SETTING_GEN_PROMPT are duplicated in NewAdventureForm.tsx and AdventurePage.tsx
- Candidate for extraction to shared module

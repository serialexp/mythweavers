# MythWeavers CLI

Command-line access to MythWeavers through its authenticated HTTP API. It never connects to PostgreSQL directly.

The default API is `http://localhost:3201`. Override it with `--api https://api.example.com` or `MYTHWEAVERS_API_URL`.
The browser authorization page comes from the backend's `verification_uri`. The backend builds that URL from its `EDITOR_URL` environment variable.

## Sign in

The backend supports OAuth device authorization:

```sh
pnpm --dir apps/mythweavers-cli cli auth:login
```

Open the printed URL, sign in, and enter the displayed code. On completion, the CLI stores the bearer token in:

```sh
${XDG_CONFIG_HOME:-~/.config}/mythweavers/config.json
```

Credentials are stored separately for each API base URL, so local and remote sign-ins do not overwrite one another. The directory and file are created with user-only permissions. `--token` and `MYTHWEAVERS_TOKEN` remain available as per-command overrides.

## Commands

```sh
pnpm --dir apps/mythweavers-cli cli stories:list
pnpm --dir apps/mythweavers-cli cli --api https://api.example.com stories:list
pnpm --dir apps/mythweavers-cli cli nodes:list <storyId>
pnpm --dir apps/mythweavers-cli cli messages:list <sceneId>
pnpm --dir apps/mythweavers-cli cli messages:read <messageId>
pnpm --dir apps/mythweavers-cli cli characters:list <storyId>
```

All story data is accessed through backend endpoints. Mutations can be added using their corresponding API endpoints without bypassing backend invariants.

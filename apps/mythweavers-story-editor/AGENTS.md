# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts SolidJS + TypeScript components, stores, utilities, and types; keep features isolated and avoid cross-layer imports.
- `public/` serves static assets through Vite, while built frontend bundles land in `dist/`.
- Backend code lives in `backend/src/` with `index.ts` as the entry point; WebSocket handlers, Express routes, and Prisma services stay in their respective subfolders.
- Database schema, migrations, and the SQLite `stories.db` file reside in `backend/prisma/`; run migrations before committing schema updates.
- Co-locate unit tests alongside source files using `*.test.ts` or `*.test.tsx`.

## Build, Test, and Development Commands
- `npm run install:all` installs dependencies in the root and backend workspaces.
- `npm run dev` starts frontend and backend concurrently; use `npm run dev:frontend` or `npm run dev:backend` for focused development.
- `npm run build` type-checks (`tsc --noEmit`) then produces optimized frontend assets.
- `npm run build:backend` transpiles the backend; launch with `node backend/dist/index.js`.
- `npm test`, `npm run test:run`, and `npm run test:ui` cover headless, CI, and interactive Vitest workflows respectively.

## Coding Style & Naming Conventions
- TypeScript strict mode is enforced; follow 2-space indentation, single quotes, and descriptive names.
- Components use PascalCase (`src/components/StoryCard.tsx`), hooks `useName.ts`, and utilities camelCase (e.g., `src/utils/fetchStories.ts`).
- Prefer succinct comments explaining intent; keep formatting consistent with existing code.

## Testing Guidelines
- Use Vitest with the `happy-dom` environment; stub external calls to keep tests deterministic.
- Name test files with `*.test.ts` or `*.test.tsx` beside the implementation.
- Run `npm test` before submitting changes; add new tests for regressions or behaviour changes.

## Commit & Pull Request Guidelines
- Write concise, imperative commit messages (e.g., `Add story pagination guard`); group related changes logically.
- PRs should explain purpose, scope, and validation steps; attach screenshots or recordings for UI updates and link relevant issues.
- Ensure linting, builds, and tests pass locally before requesting review.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and configure `backend/.env` (e.g., `DATABASE_URL` for Prisma/SQLite); never commit secrets.
- Regenerate Prisma client with `npm --prefix backend run prisma:generate` after schema changes; migrate via `npm --prefix backend run prisma:migrate`.
- Use `npm run docker:up` for local containerized runs and `npm run docker:down` to stop services; consult `DOCKER_README.md` for deployment specifics.

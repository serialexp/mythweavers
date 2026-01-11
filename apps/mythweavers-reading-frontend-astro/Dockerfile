# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files for dependency resolution
COPY apps/shared/package.json ./apps/shared/
COPY apps/mythweavers-reading-frontend-astro/package.json ./apps/mythweavers-reading-frontend-astro/
COPY packages/ui/package.json ./packages/ui/
COPY packages/solid-editor/package.json ./packages/solid-editor/
COPY packages/image-cropper/package.json ./packages/image-cropper/
COPY packages/histoire-plugin-solid/package.json ./packages/histoire-plugin-solid/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/shared ./apps/shared
COPY apps/mythweavers-reading-frontend-astro ./apps/mythweavers-reading-frontend-astro
COPY packages/ui ./packages/ui
COPY packages/solid-editor ./packages/solid-editor
COPY packages/image-cropper ./packages/image-cropper
COPY packages/histoire-plugin-solid ./packages/histoire-plugin-solid

# Build packages in order
WORKDIR /app/apps/shared
RUN pnpm build

WORKDIR /app/packages/solid-editor
RUN pnpm build

# Build UI package (skip tsc as it may have histoire dev deps)
WORKDIR /app/packages/ui
RUN pnpm vite build

# Build Astro app
WORKDIR /app/apps/mythweavers-reading-frontend-astro
RUN pnpm build

# Production stage
FROM node:22-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy the entire pnpm structure needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/mythweavers-reading-frontend-astro/node_modules ./apps/mythweavers-reading-frontend-astro/node_modules
COPY --from=builder /app/apps/mythweavers-reading-frontend-astro/dist ./apps/mythweavers-reading-frontend-astro/dist
COPY --from=builder /app/apps/mythweavers-reading-frontend-astro/package.json ./apps/mythweavers-reading-frontend-astro/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

WORKDIR /app/apps/mythweavers-reading-frontend-astro

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3202

EXPOSE 3202

# Start Astro server
CMD ["node", "./dist/server/entry.mjs"]

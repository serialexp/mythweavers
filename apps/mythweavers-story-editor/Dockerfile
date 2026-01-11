# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files for dependency resolution
COPY apps/shared/package.json ./apps/shared/
COPY apps/mythweavers-story-editor/package.json ./apps/mythweavers-story-editor/
COPY packages/ui/package.json ./packages/ui/
COPY packages/solid-editor/package.json ./packages/solid-editor/
COPY packages/image-cropper/package.json ./packages/image-cropper/
COPY packages/histoire-plugin-solid/package.json ./packages/histoire-plugin-solid/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/shared ./apps/shared
COPY apps/mythweavers-story-editor ./apps/mythweavers-story-editor
COPY packages/ui ./packages/ui
COPY packages/solid-editor ./packages/solid-editor
COPY packages/image-cropper ./packages/image-cropper
COPY packages/histoire-plugin-solid ./packages/histoire-plugin-solid

# Build packages in order
WORKDIR /app/apps/shared
RUN pnpm build

WORKDIR /app/packages/solid-editor
RUN pnpm build

WORKDIR /app/packages/image-cropper
RUN pnpm build

# Build UI package (skip tsc as it may have histoire dev deps)
WORKDIR /app/packages/ui
RUN pnpm vite build

# Build the Vite application
WORKDIR /app/apps/mythweavers-story-editor
RUN pnpm build

# Production stage - using nginx to serve static files
FROM nginx:alpine

# Install shell for entrypoint script
RUN apk add --no-cache bash

# Copy built files from builder stage
COPY --from=builder /app/apps/mythweavers-story-editor/dist /usr/share/nginx/html

# Copy configuration files
COPY apps/mythweavers-story-editor/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/mythweavers-story-editor/public/config.js /usr/share/nginx/html/config.js
COPY apps/mythweavers-story-editor/docker-entrypoint.sh /docker-entrypoint.sh

# Make entrypoint executable
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Use entrypoint script to handle runtime configuration
ENTRYPOINT ["/docker-entrypoint.sh"]

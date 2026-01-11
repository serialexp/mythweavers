# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files needed for install
COPY apps/shared/package.json ./apps/shared/
COPY apps/mythweavers-backend/package.json ./apps/mythweavers-backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/shared ./apps/shared
COPY apps/mythweavers-backend ./apps/mythweavers-backend

# Build shared package
WORKDIR /app/apps/shared
RUN pnpm build

# Generate Prisma client
WORKDIR /app/apps/mythweavers-backend
RUN pnpm prisma:generate

# Build backend
RUN pnpm build

# Production stage - use Node (same as build for compatibility)
FROM node:22-alpine

WORKDIR /app

# Install wget for healthcheck and tsx for TypeScript support
RUN apk add --no-cache wget && npm install -g tsx

# Copy the entire pnpm structure needed for the backend
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/mythweavers-backend/node_modules ./apps/mythweavers-backend/node_modules
COPY --from=builder /app/apps/mythweavers-backend/dist ./apps/mythweavers-backend/dist
COPY --from=builder /app/apps/mythweavers-backend/src ./apps/mythweavers-backend/src
COPY --from=builder /app/apps/mythweavers-backend/prisma ./apps/mythweavers-backend/prisma
COPY --from=builder /app/apps/mythweavers-backend/package.json ./apps/mythweavers-backend/
COPY --from=builder /app/apps/shared ./apps/shared
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy entrypoint script
COPY apps/mythweavers-backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

WORKDIR /app/apps/mythweavers-backend

# Environment
ENV NODE_ENV=production
ENV PORT=3201
ENV HOST=0.0.0.0

EXPOSE 3201

# Use entrypoint for migrations
ENTRYPOINT ["/docker-entrypoint.sh"]

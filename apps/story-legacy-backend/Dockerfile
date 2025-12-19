# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and prisma schema
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Production stage
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application and generated prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated

# Copy prisma schema for migrations
COPY prisma ./prisma

# Create directory for database mount point
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/stories.db"

# Run migrations and start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the Vite application
RUN pnpm build

# Production stage - using nginx to serve static files
FROM nginx:alpine

# Install shell for entrypoint script
RUN apk add --no-cache bash

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy configuration files
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/config.js /usr/share/nginx/html/config.js
COPY docker-entrypoint.sh /docker-entrypoint.sh

# Make entrypoint executable
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Use entrypoint script to handle runtime configuration
ENTRYPOINT ["/docker-entrypoint.sh"]
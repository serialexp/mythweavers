# Stage 1: Build the @writer/server package
FROM node:22 AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY apps/server/ apps/server/
COPY apps/shared/ apps/shared/
COPY pnpm-lock.yaml .
COPY pnpm-workspace.yaml .

# Install dependencies and build the @writer/server package
RUN pnpm install --filter @writer/server...
RUN pnpm deploy --filter @writer/server ./standalone

# Stage 2: Create the final image
FROM node:22

WORKDIR /app

RUN npm install -g pnpm

# Copy the built package from the builder stage
COPY --from=builder /app/standalone .
RUN pnpm exec playwright install
RUN pnpm exec playwright install-deps

CMD ["pnpm", "start"]
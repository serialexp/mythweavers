#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec tsx src/index.ts

#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/.bin/node-pg-migrate up -m src/database/migrations

echo "Migrations applied. Starting application..."
exec "$@"

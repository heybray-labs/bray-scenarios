#!/bin/sh
set -e

echo "Waiting for database..."
until node --input-type=module -e "
  import pg from 'pg';
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.end();
    process.exit(0);
  } catch {
    process.exit(1);
  }
" 2>/dev/null; do
  sleep 2
done

echo "Starting server..."
cd /app/server
exec npx tsx index.ts

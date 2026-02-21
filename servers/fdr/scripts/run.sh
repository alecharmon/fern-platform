#!/bin/sh
set -e
prisma migrate deploy --schema /app/servers/fdr/prisma/schema.prisma
bun run /app/servers/fdr/dist/server.js

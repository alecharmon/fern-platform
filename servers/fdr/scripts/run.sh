#!/bin/sh
set -e
prisma migrate deploy --schema /app/servers/fdr/prisma/schema.prisma
node /app/servers/fdr/cjs/server.cjs

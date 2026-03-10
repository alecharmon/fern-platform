#!/bin/sh
# Base image database seeding script
# This script runs during the BASE image build (not customer build) to:
# 1. Initialize PostgreSQL
# 2. Run Prisma migrations to create the schema
# 3. Save a portable schema dump for later restoration
#
# This moves the migration step into the base image, so customer builds
# and runtime can restore from the dump instead of running migrations.

set -eu

# Schema dump location (in base image)
BASE_SEED_DIR="/opt/fern-base"
SCHEMA_DUMP="$BASE_SEED_DIR/postgres-schema.dump"

log() {
    echo "[BASE-SEED $(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Helper to run PostgreSQL commands as postgres user when running as root
# This is needed because initdb refuses to run as root
run_as_postgres() {
    if [ "$(id -u)" = "0" ]; then
        su postgres -c "$*"
    else
        eval "$*"
    fi
}

log "=========================================="
log "Starting base image database seeding"
log "=========================================="

# Create base seed directory
mkdir -p "$BASE_SEED_DIR"

# -----------  Start PostgreSQL  -----------
log "Starting temporary PostgreSQL for schema migration..."

export PGBASE=/tmp/postgresql
export PGDATA=$PGBASE/data
export PGHOST=/tmp

rm -rf "$PGBASE" 2>/dev/null || true
mkdir -p "$PGDATA"

# Ensure postgres user owns the base directory (needed when running as root)
# We chown the entire /tmp/postgresql directory, not just /data,
# so postgres can access the parent directory
if [ "$(id -u)" = "0" ]; then
    chown -R postgres:postgres "$PGBASE"
fi

log "Initializing PostgreSQL cluster..."
run_as_postgres "PGDATA=$PGDATA initdb -D $PGDATA --auth-local=trust --auth-host=trust --username=postgres" 2>&1 || {
    log "ERROR: Failed to initialize PostgreSQL"
    exit 1
}

run_as_postgres "PGDATA=$PGDATA pg_ctl -D $PGDATA -o \"-c listen_addresses='localhost' -c unix_socket_directories='/tmp' -c shared_buffers=128MB -c max_connections=200\" -l $PGDATA/logfile start" 2>&1 || {
    log "ERROR: Failed to start PostgreSQL"
    exit 1
}

# Wait for PostgreSQL to be ready
i=1
while [ $i -le 30 ]; do
    if pg_isready -h /tmp -p 5432 2>/dev/null; then
        log "PostgreSQL is ready"
        break
    fi
    log "Waiting for PostgreSQL... ($i/30)"
    sleep 1
    i=$((i + 1))
done

# Create database
if command -v createdb >/dev/null 2>&1; then
    run_as_postgres "createdb -h /tmp -p 5432 -U postgres fdr" 2>&1 || log "Database 'fdr' may already exist"
else
    log "createdb not found, Prisma will create the database automatically..."
fi

# -----------  Run Prisma Migrations  -----------
log "Running Prisma migrations to create schema..."
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fdr \
    prisma migrate deploy --schema /prisma/schema.prisma 2>&1 || {
    log "ERROR: Prisma migrations failed"
    run_as_postgres "PGDATA=$PGDATA pg_ctl -D $PGDATA stop -m fast" 2>/dev/null || true
    exit 1
}

log "Prisma migrations completed successfully"

# -----------  Dump Schema  -----------
log "Dumping migrated schema to $SCHEMA_DUMP..."
if command -v pg_dump >/dev/null 2>&1; then
    run_as_postgres "pg_dump -h /tmp -p 5432 -U postgres -Fc fdr" > "$SCHEMA_DUMP" || {
        log "ERROR: Failed to dump PostgreSQL schema"
        run_as_postgres "PGDATA=$PGDATA pg_ctl -D $PGDATA stop -m fast" 2>/dev/null || true
        exit 1
    }
else
    log "WARNING: pg_dump not found, creating empty schema dump marker..."
    log "Customer builds will fall back to Prisma migrations at build time"
    touch "$SCHEMA_DUMP"
fi

log "Schema dump saved to $SCHEMA_DUMP"
log "Schema dump size: $(du -h "$SCHEMA_DUMP" | cut -f1)"

# -----------  Stop PostgreSQL  -----------
log "Stopping PostgreSQL..."
run_as_postgres "PGDATA=$PGDATA pg_ctl -D $PGDATA stop -m fast" 2>/dev/null || true

# Clean up temporary PGDATA
rm -rf "$PGDATA"

# Make schema dump readable by all (for arbitrary UID runtime)
chmod 644 "$SCHEMA_DUMP"
chmod 755 "$BASE_SEED_DIR"

log "=========================================="
log "Base image database seeding complete!"
log "=========================================="
log "Schema dump location: $SCHEMA_DUMP"
log ""
log "Customer builds can now restore from this dump instead of running migrations."
log "=========================================="

exit 0

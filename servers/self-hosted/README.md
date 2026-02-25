# Fern Self-Hosting

This repo contains a Dockerfile for self-hosting Fern's docs product. This project is a TypeScript monorepo that uses [pnpm](https://pnpm.io/). We've created a Dockerfile that can be used for self-hosting.

## Getting Started

### Pre-requisites

- Make sure Node.js 22+ and pnpm are installed on your machine
- Have Docker installed and have the daemon open on your machine

## Building the Docker Image:

To build the image from this directory:

1. execute the bash script from your terminal `sh create_self_hosted_docker.sh`
2. run the resulting image in a container `docker run fern-self-hosted:latest`

To enter a shell inside the container:

1. use the variable `RUN_MODE=shell` like follows `docker run -it -e RUN_MODE=shell fern-self-hosted`

To expose SeaweedFS ports to your host machine:

1. `docker run -p 8333:8333 -p 9333:9333 -p 8080:8080 -it -e RUN_MODE=shell fern-self-hosted:latest`
2. Visit http://localhost:8333/ to access the SeaweedFS S3-compatible API

To query postgres:

When the Docker container is built, FDR’s database migrations are automatically applied to the local Postgres instance. If you want to inspect the tables or data in your local Postgres database running inside the self-hosted Docker container, follow these steps:

1. Open a shell inside the Docker container (see instructions above)
2. Connect to Postgres using psql: `psql -h localhost -U postgres -d postgres`
3. Switch to the FDR database: `\c fdr`
4. Once connected, you can list the tables with `\dt` and you should see all the expected tables in the FDR database.

## Testing

To run the test suite from this directory:
`pnpm test:self-hosted`

## Recommended Developer Workflow

Rebuilding the docker container is slow and if you were to rebuild the container every time you made changes to any code in the fern-platform repo it would slow you down. To iterate quickly you should use the following workfow.

### Workflow to run everything:

```
cd /fern-platform
Run pnpm docs:self-hosted-bundle:build
Run pnpm --filter=@fern-platform/fdr build:tsup:cjs
Run pnpm --filter=@fern-platform/self-hosted docker:build
Run pnpm --filter=@fern-platform/self-hosted docker:run
```

Finally navigate to http://localhost:3000/ where you should see your docs

### Serving from a Base Path

To serve the docs from a base path (e.g., `/docs` instead of `/`):

**During build:**
```bash
# Option 1: Pass BASE_PATH as environment variable
BASE_PATH=/docs pnpm docs:self-hosted-bundle:build

# Option 2: Use the script directly
bash scripts/build-selfhosted-bundle.sh /docs
```

**During runtime (Docker):**
```bash
docker run -p 3000:3000 -e NEXT_PUBLIC_BASE_PATH=/docs -it fern-self-hosted:latest
```

When using a base path, your docs will be available at `http://localhost:3000/docs` instead of `http://localhost:3000/`.

### Testing Restricted Environments

To test the container with restricted security settings (simulating Kubernetes environments like Anduril's):

**Basic non-root testing:**
```bash
pnpm --filter=@fern-platform/self-hosted docker:run:nonroot
```

This runs the container as UID 65532 (non-root user) with read-only `/fern` mount.

**Full restricted mode (simulates Anduril's security context):**
```bash
pnpm --filter=@fern-platform/self-hosted docker:run:restricted
```

This runs with:
- Non-root user (UID 65532)
- No new privileges (`--security-opt no-new-privileges`)
- All capabilities dropped (`--cap-drop ALL`)
- Read-only `/fern` mount

**Expected behavior in restricted mode:**
- Container starts successfully
- PostgreSQL initializes in `/tmp` (ephemeral storage)
- Warning message: "Using temporary PostgreSQL in /tmp - data will be lost on container restart"
- All services start and function normally
- Slightly longer startup time (~30-40s extra for PostgreSQL initialization)

**Note:** The restricted scripts use `:ro` (read-only) mounts to better simulate production environments. If you need to modify files during development, use the standard `docker:run` command.

### To test changes to NextApp:

Run this outside your docker:
`pnpm docs:self-hosted-bundle:build
`

Inside your docker run the restart script:

```
cd /app/fern-platform/servers/self-hosted/scripts
sh restart_next_app.sh
```

### To test changes to FDR:

Run this outside your docker: `pnpm docs:self-hosted-fdr:compile`

Inside your docker run the restart script:

```
cd /app/fern-platform/servers/self-hosted/scripts
sh restart_fdr_server.sh
```

## Health Check Endpoints

The self-hosted container exposes health check endpoints for Kubernetes/Helm deployments on port 8081:

### Liveness Probe (`/liveness`)

Checks if all critical service processes are still running by verifying their PIDs. This endpoint helps distinguish between unrecoverable failures (process died) and slow startups.

**Usage:**
```bash
curl http://localhost:8081/liveness
```

**Response:**
- `200 OK` - All critical processes are alive
- `503 Service Unavailable` - One or more critical processes have died (container should be restarted)

**Checked Services:**
- PostgreSQL
- SeaweedFS
- FDR server
- Next.js docs server
- MeiliSearch (warning only, non-critical)

### Readiness Probe (`/readiness`)

Checks if all services are healthy and ready to serve traffic by testing their health endpoints. This endpoint only returns success when all services are fully initialized and responsive.

**Usage:**
```bash
curl http://localhost:8081/readiness
```

**Response:**
- `200 OK` - All services are ready to serve traffic
- `503 Service Unavailable` - One or more services are not ready (wait longer)

**Checked Services:**
- PostgreSQL (via `pg_isready`)
- SeaweedFS (via `/cluster/status`)
- FDR server (via `/health`)
- Next.js docs server (via root endpoint)
- MeiliSearch (warning only, non-critical)

### Legacy Health Endpoint (`/health`)

Provides backward compatibility with existing deployments. Returns the same status as the readiness probe.

**Usage:**
```bash
curl http://localhost:8081/health
```

### Kubernetes/Helm Configuration

Configure your deployment to use these probes:

```yaml
livenessProbe:
  httpGet:
    path: /liveness
    port: 8081
  initialDelaySeconds: 60
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /readiness
    port: 8081
  initialDelaySeconds: 30
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 3
```

**Benefits:**
- **Liveness probe**: Detects unrecoverable failures and triggers container restart
- **Readiness probe**: Prevents traffic routing to containers that are still starting up
- **Independent of startup time**: Deployments no longer need arbitrary timeouts like `--wait --timeout 15m0s`

### Known Issues

You may need to do the following in your repo outside the docker container as we've seen some weird caching issues:

```
pnpm clean
pnpm compile
```

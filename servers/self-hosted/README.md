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

To expose MinIO ports to your host machine:

1. `docker run -p 9000:9000 -p 9001:9001 -p 8080:8080 -it -e RUN_MODE=shell fern-self-hosted:latest`
2. Visit http://localhost:9001/
3. Should see MinIO Web UI. Can login with user/password (minioadmin, minioadmin)

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

### Known Issues

You may need to do the following in your repo outside the docker container as we've seen some weird caching issues:

```
pnpm clean
pnpm compile
```

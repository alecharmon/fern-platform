# Self-Served Fern Docs Bundle

This directory contains the Docker configuration for building and running the self-served Fern documentation bundle.

## Prerequisites

- Docker and Docker Compose installed
- `.env.selfserved` file configured with required environment variables

## Building the Docker Image

From the repository root:

```bash
docker build -f servers/self-served/Dockerfile -t fern-docs-self-served .
```

Or from this directory using Docker Compose:

```bash
docker-compose build
```

## Running the Container

### Using Docker:

```bash
docker run -p 3000:3000 --name fern-docs fern-docs-self-served
```

### Using Docker Compose:

```bash
docker-compose up
```

To run in detached mode:

```bash
docker-compose up -d
```

## Accessing the Application

Once running, the documentation site will be available at:
- http://localhost:3000

## Environment Variables

The build requires a `.env.selfserved` file in this directory. Key variables include:

- `NEXT_PUBLIC_DOCS_DOMAIN` - Update to the docs site you want to host
- Other Next.js and application-specific variables

## Build Stages

The Dockerfile uses a multi-stage build:

1. **base**: Sets up Node.js 22 and pnpm 10.11.0
2. **deps**: Installs all workspace dependencies
3. **builder**: Compiles TypeScript and builds the Next.js application in standalone mode
4. **runner**: Minimal runtime image with only the built application

## Troubleshooting

### Build fails due to missing dependencies

Ensure all workspace packages are properly copied in the Dockerfile's deps stage.

### Environment variables not loading

Make sure `.env.selfserved` exists in `servers/self-served/` before building.

### Port already in use

Change the port mapping in `docker-compose.yml` or use:
```bash
docker run -p 8080:3000 fern-docs-self-served
```

## Development

To rebuild after changes:

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## Health Check

The container includes a health check endpoint. Check container health:

```bash
docker ps  # Shows health status
```

Or manually test:

```bash
curl http://localhost:3000/api/health
```

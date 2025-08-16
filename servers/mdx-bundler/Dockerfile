FROM node:22.10-alpine AS base

FROM base AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
RUN apk update

# Produce a pruned version of the monorepo
WORKDIR /app
RUN npm install -g turbo@2.0.1
COPY . .
RUN turbo prune @fern-platform/mdx-bundler --docker

# Add lockfile and package.json's
FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN apk update
RUN npm install -g pnpm@10.11.0
WORKDIR /app

# Create and set permissions for /tmp directory
RUN mkdir -p /tmp && chmod 777 /tmp

# Install deps
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml .

# Use pnpm install --frozen-lockfile for faster installs
RUN pnpm install --no-frozen-lockfile

# Build
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN pnpm --filter @fern-docs/mdx compile
RUN pnpm --filter @fern-platform/mdx-bundler bundler:build

FROM base AS runner
WORKDIR /app

COPY --from=installer /app .

EXPOSE 8080

# ENTRYPOINT ["/bin/sh", "/app/servers/mdx-bundler/run.sh"]
# Run the server and use tail -f to keep the container running
ENTRYPOINT ["node", "--experimental-specifier-resolution=node", "/app/servers/mdx-bundler/dist/server.js"]



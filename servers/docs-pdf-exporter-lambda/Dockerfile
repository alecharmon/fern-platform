## Lambda container image for docs PDF exporting
##
## Why container:
## - Playwright/Chromium requires OS-level dependencies not present in the default
##   Node Lambda zip runtime.
## - This uses the official Playwright base image (includes required libs).

FROM node:22-bullseye-slim AS builder

WORKDIR /repo

# Enable pnpm via corepack (repo uses pnpm workspaces)
RUN corepack enable

# Copy workspace manifests first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Shared TS configs referenced by packages
COPY shared ./shared

# Copy only what we need to build this package + its workspace dependency
COPY packages/configs ./packages/configs
COPY packages/commons/docs-pdf ./packages/commons/docs-pdf
COPY servers/docs-pdf-exporter-lambda ./servers/docs-pdf-exporter-lambda

# Install deps required to build the lambda package
RUN pnpm -w install --frozen-lockfile \
  --filter @fern-platform/docs-pdf-exporter-lambda... \
  --filter @fern-api/docs-pdf...

# Build the workspace dependency that is imported via package exports.
RUN pnpm -C packages/commons/docs-pdf compile

# Build (tsup -> servers/docs-pdf-exporter-lambda/dist)
RUN pnpm -C servers/docs-pdf-exporter-lambda build

FROM mcr.microsoft.com/playwright:v1.57.0-jammy AS runtime

WORKDIR /var/task

# Avoid downloading browsers during install; Playwright image already includes them.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production

# aws-lambda-ric builds a native binary and requires build tooling.
RUN apt-get update \
  && apt-get install -y --no-install-recommends cmake build-essential autoconf automake libtool pkg-config \
  && rm -rf /var/lib/apt/lists/*

# Install runtime deps:
# - aws-lambda-ric: Lambda Runtime Interface Client for non-AWS base images
# - playwright: module resolution target for our bundle's `import { chromium } from "playwright"`
RUN npm init -y \
  && npm install --omit=dev aws-lambda-ric playwright@1.57.0

# Copy the built handler bundle into the Lambda task root
COPY --from=builder /repo/servers/docs-pdf-exporter-lambda/dist/index.cjs ./index.js

ENTRYPOINT ["npx", "aws-lambda-ric"]
CMD ["index.handler"]


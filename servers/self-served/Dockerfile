# Dockerfile for building and running the self-served docs bundle
# This dockerfile builds the Next.js docs application in standalone mode

FROM node:22-alpine AS base

# Install necessary build dependencies
RUN apk add --no-cache libc6-compat bash

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# Copy configuration files
COPY .npmrc ./
COPY pnpm-workspace.yaml ./
COPY turbo.json ./
COPY package.json pnpm-lock.yaml ./

# ===== Dependencies Stage =====
FROM base AS deps

# Copy all package.json files to properly resolve workspace dependencies
COPY packages/fern-docs/bundle/package.json ./packages/fern-docs/bundle/
COPY packages/fern-docs/components/package.json ./packages/fern-docs/components/
COPY packages/fern-docs/edge-config/package.json ./packages/fern-docs/edge-config/
COPY packages/fern-docs/mdx/package.json ./packages/fern-docs/mdx/
COPY packages/fern-docs/search-ui/package.json ./packages/fern-docs/search-ui/
COPY packages/fern-docs/icons-cdn/package.json ./packages/fern-docs/icons-cdn/
COPY packages/fern-docs/search-server/utils/package.json ./packages/fern-docs/search-server/utils/
COPY packages/fern-docs/search-server/ask-fern/package.json ./packages/fern-docs/search-server/ask-fern/
COPY packages/fern-docs/search-server/keyword/package.json ./packages/fern-docs/search-server/keyword/
COPY packages/commons/core-utils/package.json ./packages/commons/core-utils/
COPY packages/commons/docs-auth/package.json ./packages/commons/docs-auth/
COPY packages/commons/docs-loader/package.json ./packages/commons/docs-loader/
COPY packages/commons/docs-server/package.json ./packages/commons/docs-server/
COPY packages/commons/docs-utils/package.json ./packages/commons/docs-utils/
COPY packages/commons/fdr-utils/package.json ./packages/commons/fdr-utils/
COPY packages/commons/github/package.json ./packages/commons/github/
COPY packages/commons/loadable/package.json ./packages/commons/loadable/
COPY packages/commons/react-commons/package.json ./packages/commons/react-commons/
COPY packages/commons/visual-editor-server/package.json ./packages/commons/visual-editor-server/
COPY packages/configs/package.json ./packages/configs/
COPY packages/fdr-sdk/package.json ./packages/fdr-sdk/
COPY packages/fdr-lambda-sdk/package.json ./packages/fdr-lambda-sdk/
COPY packages/fai-sdk/package.json ./packages/fai-sdk/
COPY packages/snippets/package.json ./packages/snippets/

# Install dependencies (use --no-frozen-lockfile for Docker builds)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --no-frozen-lockfile --filter=@fern-docs/bundle...

# ===== Builder Stage =====
FROM base AS builder

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY packages/fern-docs ./packages/fern-docs
COPY packages/commons ./packages/commons
COPY packages/configs ./packages/configs
COPY packages/fdr-sdk ./packages/fdr-sdk
COPY packages/fdr-lambda-sdk ./packages/fdr-lambda-sdk
COPY packages/fai-sdk ./packages/fai-sdk
COPY packages/snippets ./packages/snippets
COPY packages/ui ./packages/ui

# Copy .env.selfserved file for build-time environment variables
# This file MUST exist for the build to work properly
COPY servers/self-served/.env.selfserved /app/.env.selfserved

# Build all workspace dependencies using turbo (handles dependency order automatically)
# Use build instead of compile as it includes codegen and handles all package types
RUN pnpm turbo build --filter=@fern-docs/bundle^... --no-cache

# Build the application with environment variables from .env.selfserved
# Increase Node memory limit for Next.js build
RUN set -a && \
    . /app/.env.selfserved && \
    set +a && \
    NODE_ENV=production NODE_OPTIONS="--max-old-space-size=4096" pnpm --filter=@fern-docs/bundle docs:build:selfserved

# Restructure for standalone deployment
RUN cp -r packages/fern-docs/bundle/.next/static packages/fern-docs/bundle/.next/standalone/packages/fern-docs/bundle/.next && \
    find packages/fern-docs/bundle/.next -depth -mindepth 1 -not -path "packages/fern-docs/bundle/.next/standalone*" -exec rm -rf {} \;

# ===== Runtime Stage =====
FROM node:22-alpine AS runner

RUN apk add --no-cache bash

WORKDIR /app

# Copy necessary files for runtime
COPY --from=builder /app/packages/fern-docs/bundle/.next/standalone ./
COPY --from=builder /app/.env.selfserved /app/.env.selfserved

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the server with environment variables loaded from .env.selfserved
CMD ["/bin/sh", "-c", "set -a && . /app/.env.selfserved && set +a && node packages/fern-docs/bundle/server.js"]

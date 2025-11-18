FROM node:22-alpine AS base

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./
COPY turbo.json ./

# Copy all package.json files for proper workspace resolution
COPY packages/fdr-sdk/package.json ./packages/fdr-sdk/
COPY packages/fdr-lambda-sdk/package.json ./packages/fdr-lambda-sdk/
COPY packages/fai-sdk/package.json ./packages/fai-sdk/
COPY packages/commons/docs-server/package.json ./packages/commons/docs-server/
COPY packages/commons/docs-utils/package.json ./packages/commons/docs-utils/
COPY packages/commons/docs-loader/package.json ./packages/commons/docs-loader/
COPY packages/fern-docs/search-server/utils/package.json ./packages/fern-docs/search-server/utils/
COPY packages/fern-docs/search-server/ask-fern/package.json ./packages/fern-docs/search-server/ask-fern/
COPY packages/fern-docs/mdx/package.json ./packages/fern-docs/mdx/
COPY packages/commons/core-utils/package.json ./packages/commons/core-utils/
COPY packages/configs/package.json ./packages/configs/
COPY packages/snippets/package.json ./packages/snippets/
COPY servers/fai-reindexing-worker/package.json ./servers/fai-reindexing-worker/

# Install dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile --filter @fern-platform/fai-reindexing-worker...

# Build stage
FROM base AS builder

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/servers/fai-reindexing-worker/node_modules ./servers/fai-reindexing-worker/node_modules

# Copy all source code for workspace dependencies
COPY packages/commons/docs-utils ./packages/commons/docs-utils
COPY packages/commons/core-utils ./packages/commons/core-utils
COPY packages/fern-docs/search-server/utils ./packages/fern-docs/search-server/utils
COPY packages/fern-docs/mdx ./packages/fern-docs/mdx
COPY packages/fdr-sdk ./packages/fdr-sdk
COPY packages/fdr-lambda-sdk ./packages/fdr-lambda-sdk
COPY packages/fai-sdk ./packages/fai-sdk
COPY packages/snippets ./packages/snippets
COPY packages/configs ./packages/configs

# Copy turbo config and tsconfig
COPY turbo.json ./
COPY tsconfig.json ./

# Build all dependencies for the worker using turbo (handles dependency order)
RUN pnpm turbo compile --filter=@fern-platform/fai-reindexing-worker^... --no-cache
# fai-sdk uses 'build' instead of 'compile', so build it separately
RUN pnpm --filter=@fern-api/fai-sdk build

# Copy worker source
COPY servers/fai-reindexing-worker ./servers/fai-reindexing-worker

# Build the worker
WORKDIR /app/servers/fai-reindexing-worker
RUN pnpm build

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app

# Install pnpm for workspace support
RUN npm install -g pnpm@10.11.0

# Copy workspace configuration
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy all node_modules (root and workspace packages)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/servers/fai-reindexing-worker/node_modules ./servers/fai-reindexing-worker/node_modules

# Copy workspace packages with their built dist folders from builder stage
# The packages are referenced via symlinks in node_modules, so we need the actual built files
COPY --from=builder /app/packages ./packages

# Copy worker files
COPY --from=builder /app/servers/fai-reindexing-worker/dist ./servers/fai-reindexing-worker/dist
COPY --from=builder /app/servers/fai-reindexing-worker/package.json ./servers/fai-reindexing-worker/package.json

# Set working directory to worker
WORKDIR /app/servers/fai-reindexing-worker

# Set environment
ENV NODE_ENV=production

# Start the worker
CMD ["node", "dist/index.js"]

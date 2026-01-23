FROM node:22-alpine AS base

RUN npm install -g pnpm@10.28.1

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./
COPY turbo.json ./

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
COPY servers/fai-reindexing/package.json ./servers/fai-reindexing/

FROM base AS deps
RUN pnpm install --frozen-lockfile --filter @fern-platform/fai-reindexing...

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/servers/fai-reindexing/node_modules ./servers/fai-reindexing/node_modules

COPY packages/commons/docs-utils ./packages/commons/docs-utils
COPY packages/commons/core-utils ./packages/commons/core-utils
COPY packages/fern-docs/search-server/utils ./packages/fern-docs/search-server/utils
COPY packages/fern-docs/mdx ./packages/fern-docs/mdx
COPY packages/fdr-sdk ./packages/fdr-sdk
COPY packages/fdr-lambda-sdk ./packages/fdr-lambda-sdk
COPY packages/fai-sdk ./packages/fai-sdk
COPY packages/snippets ./packages/snippets
COPY packages/configs ./packages/configs
COPY turbo.json ./
COPY tsconfig.json ./

RUN pnpm turbo compile --filter=@fern-platform/fai-reindexing^... --no-cache
RUN pnpm --filter=@fern-api/fai-sdk build

COPY servers/fai-reindexing ./servers/fai-reindexing
WORKDIR /app/servers/fai-reindexing

RUN pnpm tsup --config tsup.bundle.config.ts

RUN ls -lh dist-bundle/

FROM node:22-alpine AS runner
WORKDIR /app

# Install dependencies and patch tar to fix CVE-2026-23950 (GHSA-r6q2-hw4h-h46w)
RUN npm install -g pnpm@10.28.1 && \
    pnpm add \
        @aws-sdk/client-ecs@^3.709.0 \
        @aws-sdk/client-sqs@^3.709.0 \
        --prod && \
    npm pack tar@7.5.4 && \
    tar -xzf tar-7.5.4.tgz && \
    rm -rf /usr/local/lib/node_modules/pnpm/dist/node_modules/tar && \
    mv package /usr/local/lib/node_modules/pnpm/dist/node_modules/tar && \
    rm tar-7.5.4.tgz && \
    rm -rf ~/.pnpm-store && \
    rm -rf /usr/local/lib/node_modules/npm

COPY --from=builder /app/servers/fai-reindexing/dist-bundle ./dist

ENV NODE_ENV=production

CMD ["node", "dist/index.cjs"]

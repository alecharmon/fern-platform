FROM cgr.dev/chainguard/node:latest-dev AS base

FROM base AS builder
USER root

# Produce a pruned version of the monorepo
WORKDIR /app
RUN npm install -g turbo@2.0.1
COPY . .
RUN turbo prune @fern-platform/fdr --docker

# Add lockfile and package.json's
FROM base AS installer
USER root
RUN npm install -g pnpm@10.27.0 fern-api
WORKDIR /app

# Install deps
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml .
RUN pnpm install

ARG FERN_TOKEN
ENV FERN_TOKEN=$FERN_TOKEN

# Build
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
COPY shared shared
COPY fern fern
RUN pnpm turbo --filter=@fern-api/fdr-sdk compile
RUN pnpm turbo --filter=@fern-platform/fdr codegen
RUN pnpm turbo --filter=@fern-platform/fdr compile
RUN pnpm --filter=@fern-platform/fdr build:tsup:cjs

FROM base AS runner
USER root
WORKDIR /app

RUN npm install -g prisma@5.13.0

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

COPY --from=installer /app .

# Switch back to non-root user for runtime security
USER 65532

ENTRYPOINT ["/bin/sh", "/app/servers/fdr/scripts/run.sh"]

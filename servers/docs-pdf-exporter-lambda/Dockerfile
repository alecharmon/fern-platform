## Lambda container image for docs PDF exporting
##
## Why container:
## - Playwright/Chromium requires OS-level dependencies not present in the default
##   Node Lambda zip runtime.
## - This uses the official Playwright base image (includes required libs).
##
## The handler bundle is pre-built by tsup in CI before CDK runs.

FROM mcr.microsoft.com/playwright:v1.57.0-jammy

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

# Copy the pre-built handler bundle (built by tsup before CDK runs)
COPY dist/index.cjs ./index.js

ENTRYPOINT ["npx", "aws-lambda-ric"]
CMD ["index.handler"]

# Builder stage: use Alpine with build tools to compile native dependencies
FROM node:25-alpine AS builder

# Install build tools for native dependencies
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev

WORKDIR /mdx-bundler

# Install patch-package globally to satisfy transitive postinstall scripts
RUN npm install -g patch-package@^8

# Create package.json and install dependencies locally
RUN echo '{"name": "mdx-bundler-server", "dependencies": {"typescript": "^5", "esbuild": "0.27.0", "react": ">=18.2.0", "@aa-sdk/core": "^4.40.0", "@account-kit/core": "^4.40.0", "@account-kit/infra": "^4.40.0", "@account-kit/react": "^4.40.0", "@account-kit/react-native": "^4.40.0", "@account-kit/react-native-signer": "^4.40.0", "@account-kit/signer": "^4.40.0", "@account-kit/smart-contracts": "^4.40.0", "@shikijs/rehype": "^3.2.1", "@shikijs/transformers": "^3.2.1", "@shikijs/twoslash": "^3.2.1", "@tanstack/react-query": "^5.71.1", "@types/cors": "^2.8.13", "@types/express": "^4.17.13", "@types/hast": "^3.0.4", "@types/jest": "^29.5.14", "@types/mdast": "^4.0.4", "@types/mdx": "^2.0.13", "@types/node": "^20.17.32", "@types/react": "19.0.10", "@types/react-dom": "19.0.4", "@typescript/vfs": "^1.6.1", "@vercel/node": "^2.9.6", "cors": "^2.8.5", "es-toolkit": "^1.32.0", "estree-util-to-js": "^2.0.0", "estree-walker": "^3.0.3", "express": "^5.0.0", "hast-util-properties-to-mdx-jsx-attributes": "^1.0.1", "hast-util-to-estree": "^3.1.1", "mdast": "^3.0.0", "mdast-util-directive": "^3.1.0", "mdast-util-from-markdown": "^2.0.2", "mdast-util-gfm": "^3.0.0", "mdast-util-to-hast": "^13.2.0", "mdx-bundler": "^10.1.1", "parse-numeric-range": "^1.3.0", "path-to-regexp": "^6.3.0", "qrcode.react": "^4.2.0", "react-dom": "19.0.0", "react-native": "^0.79.2", "shiki": "^3.2.1", "ts-essentials": "^10.0.4", "tsup": "^8.5.1", "tsx": "^4.7.1", "twoslash": "^0.3.1", "unified": "^11.0.5", "unist-util-visit": "^5.0.0", "viem": "^2.29.0", "vitest": "^3.2.4", "yaml": "^2.3.1"},"overrides": {"esbuild": "0.27.0", "@tanstack/form-core": "^0.42.1", "@walletconnect/logger": "3.0.0", "path-to-regexp": "^6.3.0"}}' > package.json
RUN npm install

# Final stage: use Chainguard Wolfi base for security
FROM cgr.dev/chainguard/wolfi-base:latest

# Install Node.js, npm, and GNU wget (needed for health checks)
# GNU wget is explicitly installed to avoid CVE-2025-60876 in busybox wget
RUN apk add --no-cache nodejs npm wget

WORKDIR /mdx-bundler

# Copy node_modules from builder stage
COPY --from=builder /mdx-bundler/node_modules ./node_modules

# Copy the bundled server file and wrapper script
COPY servers/mdx-bundler/cjs/server.cjs .
COPY --chmod=755 servers/mdx-bundler/scripts/run-server.sh .
COPY servers/mdx-bundler/scripts/polyfill-localstorage.cjs .

EXPOSE 8080

# Run the server with the wrapper script
ENTRYPOINT ["./run-server.sh"]

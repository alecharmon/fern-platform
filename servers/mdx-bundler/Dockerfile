FROM node:22.10-alpine

# install python and build tools for native dependencies
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev

WORKDIR /mdx-bundler

# Create package.json and install dependencies locally
RUN echo '{"name": "mdx-bundler-server", "dependencies": {"typescript": "^5", "esbuild": "0.25.0", "react": ">=18.2.0", "@aa-sdk/core": "^4.31.2", "@account-kit/core": "^4.31.2", "@account-kit/infra": "^4.32.0", "@account-kit/react": "^4.31.2", "@account-kit/react-native": "^4.31.2", "@account-kit/react-native-signer": "^4.31.2", "@account-kit/signer": "^4.31.2", "@account-kit/smart-contracts": "^4.31.2", "@shikijs/rehype": "^3.2.1", "@shikijs/transformers": "^3.2.1", "@shikijs/twoslash": "^3.2.1", "@tanstack/react-query": "^5.71.1", "@types/cors": "^2.8.13", "@types/express": "^4.17.13", "@types/hast": "^3.0.4", "@types/jest": "^29.5.14", "@types/mdast": "^4.0.4", "@types/mdx": "^2.0.13", "@types/node": "^20.17.32", "@types/react": "19.0.10", "@types/react-dom": "19.0.4", "@typescript/vfs": "^1.6.1", "@vercel/node": "^2.9.6", "cors": "^2.8.5", "es-toolkit": "^1.32.0", "estree-util-to-js": "^2.0.0", "estree-walker": "^3.0.3", "express": "^5.0.0", "hast-util-properties-to-mdx-jsx-attributes": "^1.0.0", "hast-util-to-estree": "^3.1.1", "mdast": "^3.0.0", "mdast-util-directive": "^3.1.0", "mdast-util-from-markdown": "^2.0.2", "mdast-util-gfm": "^3.0.0", "mdast-util-to-hast": "^13.2.0", "mdx-bundler": "^10.1.1", "parse-numeric-range": "^1.3.0", "path-to-regexp": "^6.3.0", "qrcode.react": "^4.2.0", "react-dom": "19.0.0", "react-native": "^0.79.2", "shiki": "^3.2.1", "ts-essentials": "^10.0.4", "tsup": "^8.3.5", "tsx": "^4.7.1", "twoslash": "^0.3.1", "unified": "^11.0.5", "unist-util-visit": "^5.0.0", "viem": "^2.29.0", "vitest": "^3.1.3", "yaml": "^2.3.1"}}' > package.json
RUN npm install

# copy the bundled server file and wrapper script
COPY servers/mdx-bundler/cjs/server.cjs .
COPY servers/mdx-bundler/scripts/run-server.sh .

# Make the wrapper script executable
RUN chmod +x ./run-server.sh

EXPOSE 8080

# run the server with the wrapper script
ENTRYPOINT ["./run-server.sh"]
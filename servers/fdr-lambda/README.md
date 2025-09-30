# FDR Lambda

A simple Node.js AWS Lambda function using pnpm.

## Development

```bash
# Install dependencies
pnpm install

# Build the function
pnpm build

# Watch for changes during development
pnpm dev

# Package for deployment
pnpm package
```

## Structure

- `src/index.ts` - Main Lambda handler
- `dist/` - Compiled JavaScript output
- `tsconfig.json` - TypeScript configuration

## Deployment

The function can be deployed using the AWS CLI:

```bash
pnpm deploy
```

Note: Make sure to update the function name in package.json scripts to match your actual Lambda function name.

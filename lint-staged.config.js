module.exports = {
    "**/*.ts{,x}": ["pnpm exec biome check --write", "pnpm format"],
    "**/*.{js,json,yml,html,css,less,scss,md}": "pnpm format",
    "**/package.json": () => "pnpm install --immutable"
};

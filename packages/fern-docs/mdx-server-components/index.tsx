// Re-export the component factory for server-side use.
// This package is listed in serverExternalPackages so Turbopack
// won't analyze its dependency tree — it's loaded via require() at runtime.
//
// The actual compiled output is in dist/index.js (built by build.mjs).
// This .tsx file exists only for TypeScript IDE support.
export { createMdxComponents } from "../bundle/src/mdx/components/index";

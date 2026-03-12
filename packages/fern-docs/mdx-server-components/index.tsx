// Re-export the component factory for server-side use.
// This package is listed in serverExternalPackages so Turbopack
// won't analyze its dependency tree — it's loaded via require() at runtime.
//
// The actual compiled output is in dist/index.js (built by build.mjs).
// This .tsx file exists only for TypeScript IDE support.

export { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
export { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
// Re-export Next.js context objects from the BUNDLED copies so the host's
// renderWithNextContext uses the same references as the bundled components.
// Without this, the host would import its own copies of these contexts,
// which are different JS objects from the ones bundled into dist/index.js,
// causing context providers to be invisible to bundled consumers.
export { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
export { createMdxComponents } from "../bundle/src/mdx/components/index";

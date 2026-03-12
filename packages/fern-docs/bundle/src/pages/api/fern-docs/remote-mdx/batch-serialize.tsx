import type { NextApiRequest, NextApiResponse } from "next";
import { handleBatchSerialize } from "../../../../server/remote-renderer/batch-serialize-handler";

// Increase body size limit for large batches (API pages with many descriptions)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb"
        }
    }
};

/**
 * Lazily load the pre-compiled component factory and bundled context objects.
 *
 * Uses eval("require") to hide the import from Turbopack's static analysis.
 * The @fern-docs/mdx-server-components package is pre-built by esbuild into
 * a CJS bundle that strips "use client" and next/dynamic directives, making
 * it safe for renderToString in a Pages Router API route.
 *
 * next/* modules are bundled INTO dist/index.js to avoid Vercel's broken pnpm
 * symlink resolution. The package also exports the bundled React context objects
 * (ImageConfigContext, SearchParamsContext, etc.) so the host's renderWithNextContext
 * uses the same context references as the bundled components.
 */
function loadMdxServerComponents() {
    // eslint-disable-next-line no-eval
    const mod = eval("require")("@fern-docs/mdx-server-components");
    return {
        createMdxComponents: mod.createMdxComponents as (
            jsxElements: string[]
        ) => import("@fern-docs/mdx").MDXComponents,
        bundledContexts: {
            ImageConfigContext: mod.ImageConfigContext,
            SearchParamsContext: mod.SearchParamsContext,
            PathnameContext: mod.PathnameContext,
            AppRouterContext: mod.AppRouterContext
        }
    };
}

/**
 * Local remote builder batch-serialize endpoint (Pages Router).
 *
 * Uses real MDX components via @fern-docs/mdx-server-components, which is
 * pre-compiled by esbuild to strip "use client" / next/dynamic directives.
 *
 * This produces semantic SSR HTML identical to the production remote renderer.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const body = req.body;

        if (!body.items?.length || !body.loaderContext) {
            return res.status(400).json({ error: "items[] and loaderContext required" });
        }

        const { createMdxComponents, bundledContexts } = loadMdxServerComponents();
        const results = await handleBatchSerialize(
            body,
            "[local-batch-serialize]",
            createMdxComponents,
            bundledContexts
        );
        return res.status(200).json(results);
    } catch (error: unknown) {
        console.error("[batch-serialize] Handler error:", error);
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        return res.status(500).json({ error: message, stack });
    }
}

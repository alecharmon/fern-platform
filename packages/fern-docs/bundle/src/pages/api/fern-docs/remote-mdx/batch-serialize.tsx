import type { NextApiRequest, NextApiResponse } from "next";
import { handleBatchSerialize } from "../../../../server/remote-renderer/batch-serialize-handler";
import { getRemoteRenderingMode } from "../../../../server/remote-renderer/feature-flags";

// Increase body size limit for large batches (API pages with many descriptions)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb"
        }
    }
};

/**
 * Lazily load the pre-compiled component factory at runtime.
 *
 * Uses eval("require") to prevent Turbopack from statically analyzing the import.
 * The @fern-docs/mdx-server-components package contains a pre-built CJS file
 * (compiled by esbuild) that strips "use client" and next/dynamic directives,
 * making it safe to use in a Pages Router API route for renderToString.
 *
 * Why eval("require") instead of a normal import:
 * - Static import: Turbopack traces the entire dependency tree at build time,
 *   hitting "use client" / next/dynamic errors in the component tree.
 * - serverExternalPackages: Turbopack still analyzes workspace-linked packages,
 *   finding UMD/AMD patterns and dynamic require() calls it can't resolve.
 * - eval("require"): Turbopack sees eval() and gives up static analysis entirely.
 *   At runtime, Node.js loads the pre-compiled CJS file natively.
 */
function getCreateMdxComponents(): (jsxElements: string[]) => import("@fern-docs/mdx").MDXComponents {
    // eslint-disable-next-line no-eval
    const mod = eval("require")("@fern-docs/mdx-server-components");
    return mod.createMdxComponents;
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
    if (getRemoteRenderingMode() !== "local-remote") {
        return res.status(404).json({ error: "Not found" });
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body;

    if (!body.items?.length || !body.loaderContext) {
        return res.status(400).json({ error: "items[] and loaderContext required" });
    }

    const createMdxComponents = getCreateMdxComponents();
    const results = await handleBatchSerialize(body, "[local-batch-serialize]", createMdxComponents);
    return res.status(200).json(results);
}

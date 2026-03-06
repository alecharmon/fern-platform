// @ts-expect-error - Webpack resolves @bundle/* at runtime; "use client" and next/dynamic are stripped by string-replace-loader
import { createMdxComponents } from "@bundle/mdx/components";
// @ts-expect-error - Webpack resolves @bundle/* at runtime
import { type BatchRequest, handleBatchSerialize } from "@bundle/server/remote-renderer/batch-serialize-handler";
import type { NextApiRequest, NextApiResponse } from "next";

// Increase body size limit for large batches (API pages with many descriptions)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb"
        }
    }
};

/**
 * Remote renderer batch-serialize endpoint (Pages Router wrapper).
 *
 * The core logic lives in the bundle's batch-serialize-handler.tsx,
 * imported here via @bundle/* webpack alias. This ensures a single
 * source of truth for the serialization pipeline.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const body: BatchRequest = req.body;

    if (!body.items?.length || !body.loaderContext) {
        return res.status(400).json({ error: "items[] and loaderContext required" });
    }

    const results = await handleBatchSerialize(body, "[batch-serialize]", createMdxComponents);
    return res.status(200).json(results);
}

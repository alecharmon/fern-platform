import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Health check endpoint for the remote renderer.
 * Used by the bundle to verify the remote renderer is available before attempting to render.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    return res.status(200).json({
        status: "ok",
        service: "mdx-remote-renderer",
        timestamp: new Date().toISOString()
    });
}

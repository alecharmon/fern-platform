import type { NextApiRequest, NextApiResponse } from "next";
import { getRemoteRenderingMode } from "../../../../server/remote-renderer/feature-flags";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (getRemoteRenderingMode() !== "local-remote") {
        return res.status(404).json({ error: "Not found" });
    }

    return res.status(200).json({ status: "ok", router: "pages" });
}

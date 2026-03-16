"use server";

import { getCurrentSession } from "../services/auth0/getCurrentSession";
import { setRecentPath } from "../services/auth0/recentPath";

const TRACKABLE_SEGMENTS = new Set(["docs", "billing", "members", "ai-usage", "settings"]);

function isTrackablePath(path: string): boolean {
    const segment = path.split("/")[2]; // e.g. "/acme/docs/..." → "docs"
    return segment != null && TRACKABLE_SEGMENTS.has(segment);
}

export async function updateRecentPath(path: string): Promise<void> {
    if (!isTrackablePath(path)) {
        return;
    }

    const session = await getCurrentSession();
    if (!session) {
        return;
    }

    await setRecentPath(session.user.sub, path);
}

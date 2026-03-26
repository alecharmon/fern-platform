/**
 * Mode configuration for rendering mode overrides.
 *
 * Each key in the MODES map corresponds to a URL path segment used by the middleware
 * rewrite (e.g., `/<mode>/<slug>`). The page reads `params.mode` and applies the
 * associated rendering overrides.
 *
 * To add a new mode:
 * 1. Add an entry to the MODES map below
 * 2. Update the middleware in proxy.ts to rewrite to the new mode slug
 */

import type { RemoteRenderingMode } from "@/server/remote-renderer";

interface ModeConfig {
    /** If set, overrides the MDX rendering mode for this request */
    renderingMode?: Extract<RemoteRenderingMode, "local-remote" | "production-remote">;
}

const DEFAULT_MODE: ModeConfig = {};

const MODES: Record<string, ModeConfig> = {
    default: DEFAULT_MODE,
    "production-remote": { renderingMode: "production-remote" },
    "local-remote": { renderingMode: "local-remote" }
};

export function getModeConfig(mode: string): ModeConfig {
    return MODES[mode] ?? DEFAULT_MODE;
}

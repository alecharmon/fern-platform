/**
 * Helpers for reading and writing Edge Config items.
 *
 * - Reads use the `@vercel/edge-config` SDK (globally distributed, low-latency).
 * - Writes use the Vercel REST API (PATCH /v1/edge-config/{id}/items).
 *
 * Required env vars:
 *   EDGE_CONFIG            — connection string (set automatically when the Edge Config is linked to the project)
 *   VERCEL_API_TOKEN       — a Vercel API token with write access to the Edge Config
 *   VERCEL_TEAM_ID         — (optional) the Vercel team ID, required if the Edge Config is team-scoped
 */

import { get } from "@vercel/edge-config";

function getEdgeConfigId(): string {
    const connectionString = process.env.EDGE_CONFIG;
    if (!connectionString) {
        throw new Error("EDGE_CONFIG environment variable is not set");
    }
    // connection string format: https://edge-config.vercel.com/<edgeConfigId>?token=<token>
    const url = new URL(connectionString);
    const id = url.pathname.replace(/^\//, "");
    if (!id) {
        throw new Error("Could not extract Edge Config ID from EDGE_CONFIG connection string");
    }
    return id;
}

function getVercelApiToken(): string {
    const token = process.env.VERCEL_API_TOKEN;
    if (!token) {
        throw new Error("VERCEL_API_TOKEN environment variable is not set");
    }
    return token;
}

function getTeamIdParam(): string {
    const teamId = process.env.VERCEL_TEAM_ID;
    return teamId ? `?teamId=${teamId}` : "";
}

/**
 * Read a single item from Edge Config using the SDK (optimized, globally distributed reads).
 */
export async function readEdgeConfigItem<T>(key: string): Promise<T | undefined> {
    return get<T>(key) ?? undefined;
}

/**
 * Write items to Edge Config using the Vercel REST API.
 *
 * @see https://vercel.com/docs/edge-config/vercel-api#update-your-edge-config-items
 */
export async function patchEdgeConfigItems(
    items: Array<{
        operation: "create" | "update" | "upsert" | "delete";
        key: string;
        value?: unknown;
    }>
): Promise<void> {
    const edgeConfigId = getEdgeConfigId();
    const apiToken = getVercelApiToken();
    const teamParam = getTeamIdParam();

    const url = `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items${teamParam}`;

    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ items })
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Vercel Edge Config API error: ${response.status} ${response.statusText} — ${body}`);
    }
}

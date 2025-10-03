import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

export type EdgeConfigValue = Record<string, unknown> | readonly string[];

// avoid accessing the edge config within local development mode
export async function getEdge<T>(key: string): Promise<T | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }
    const { get } = await import("@vercel/edge-config");
    return get<T>(key);
}

export async function getAllEdge<T extends Record<string, unknown>>(keys: readonly string[]): Promise<T | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }
    const { getAll } = await import("@vercel/edge-config");
    return await getAll<T>(keys as string[]);
}

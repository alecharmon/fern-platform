import { getAuthEdgeConfig } from "@fern-docs/edge-config";

/**
 * Checks if authentication is configured for a domain.
 *
 * When auth is configured for a domain, content requires authentication by default.
 * The `createViewersForNodes` function (called later in the indexing pipeline) will
 * check if the node's viewers include "everyone" and set authed=false if so.
 *
 * This follows the RBAC-first approach where:
 * 1. If auth is configured, default to requiring auth (return true)
 * 2. Let createViewersForNodes handle the viewers check
 * 3. If viewers includes "everyone", the final authed value will be false
 */
export async function isAuthConfigured(domain: string): Promise<boolean> {
    const authEdgeConfig = await getAuthEdgeConfig(domain);
    return authEdgeConfig != null;
}

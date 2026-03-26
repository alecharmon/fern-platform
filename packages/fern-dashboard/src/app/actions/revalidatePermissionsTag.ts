"use server";

import { revalidateTag } from "next/cache";

import type { Auth0OrgName, Auth0UserID } from "../services/auth0/types";

/**
 * Revalidates the cached permission check for a user in an organization.
 * This must be called from a client component (e.g., via useEffect) rather
 * than during server-component render, because revalidateTag is unsupported
 * during render.
 */
export async function revalidatePermissionsTag(orgName: Auth0OrgName, userId: Auth0UserID): Promise<void> {
    revalidateTag(`permissions:${orgName}:${userId}`);
}

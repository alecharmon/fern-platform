import { addRoles } from "@fern-api/user-permissions";
import { z } from "zod";
import * as auth0Management from "@/app/services/auth0/management";
import { getCurrentSession } from "./app/services/auth0/getCurrentSession";
import { Auth0OrgName, type Auth0UserID } from "./app/services/auth0/types";
import { isProduction } from "./utils/environment";

const inFlightPromises: Record<string, Promise<void>> = {};

// Zod schema for parsing EMAIL_ORG_MAPPINGS environment variable
const EmailOrgMappingsSchema = z.record(z.string().startsWith("@"), z.string());

/**
 * Helper function to parse EMAIL_ORG_MAPPINGS environment variable
 * Returns the parsed mapping or null if not available/invalid
 */
function parseEmailOrgMappings(): Record<string, string> | null {
    const emailOrgMappingsEnv = process.env.EMAIL_ORG_MAPPINGS;

    if (!emailOrgMappingsEnv) {
        console[isProduction() ? "warn" : "debug"]("EMAIL_ORG_MAPPINGS environment variable is not set");
        return {};
    }

    try {
        const parsed = JSON.parse(emailOrgMappingsEnv);
        const validated = EmailOrgMappingsSchema.parse(parsed);
        return validated;
    } catch (error) {
        console.error("Failed to parse EMAIL_ORG_MAPPINGS environment variable:", error);
        return {};
    }
}
async function processUserOrgMapping(userId: Auth0UserID, permissions: string[]): Promise<void> {
    // Parse email org mappings from environment variable
    const emailOrgMappings = parseEmailOrgMappings();

    if (!emailOrgMappings) {
        return; // Early return if no mappings available
    }

    // NOTE: The following Auth0 API calls have strict sequential dependencies and cannot be parallelized:
    // 1. getUserGoogleOauth2EmailInfo - must complete first to get email for org matching
    // 2. doesUserBelongToOrg - requires auth0OrgName derived from email result
    // 3. addUserToOrg - only called conditionally based on doesUserBelongToOrg result

    const { email, isEmailVerified } = await auth0Management.getUserGoogleOauth2EmailInfo(userId);

    if (!email || !isEmailVerified) {
        return;
    }

    // Find matching org for email suffix
    const matchingOrg = Object.entries(emailOrgMappings).find(([suffix]) => email.endsWith(suffix));

    if (!matchingOrg) {
        return;
    }

    const [, orgName] = matchingOrg;
    const auth0OrgName = Auth0OrgName(orgName);

    // Check if user is already a member of the org
    const userBelongsToOrg = await auth0Management.doesUserBelongToOrg(userId, auth0OrgName, { permissions });

    if (userBelongsToOrg) {
        return;
    }

    // Add user to the organization
    await auth0Management.addUserToOrg(userId, auth0OrgName);
    const orgId = await auth0Management.getOrgIdFromName(auth0OrgName);

    await addRoles({
        userId,
        orgId,
        roleNames: ["editor"]
    });
}

export async function applyOrgMappings(): Promise<void> {
    try {
        const session = await getCurrentSession();

        if (session == null) {
            return;
        }

        const userId = session.user.sub;
        const permissions = session.permissions ?? [];

        // Check if we already have an in-flight promise for this user
        const existingPromise = inFlightPromises[userId];
        if (existingPromise != null) {
            return await existingPromise;
        }

        // Create and store the promise for this user
        const promise = processUserOrgMapping(userId, permissions);

        inFlightPromises[userId] = promise;

        return await promise;
    } catch (error) {
        // Log error but don't throw to avoid breaking the middleware flow
        console.error("Error in applyOrgMappings:", error);
    }
}

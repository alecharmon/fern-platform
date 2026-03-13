import "server-only";

import jwt from "jsonwebtoken";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import {
    addUserToOrgById,
    doesUserBelongToOrg,
    getOrgIdFromName,
    invalidateCachesAfterAddingOrgMember
} from "@/app/services/auth0/management";
import { Auth0UserID } from "@/app/services/auth0/types";
import { getOrgNameFromDocsUrl } from "@/app/services/dal/getOrgNameFromDocsUrl";
import { getAppInstallationByTeamId } from "@/app/services/postman/repository";
import { PosthogEventName } from "@/components/posthog/events";
import { getServerSidePosthog } from "@/components/posthog/getServerSidePosthog";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import orgRedirect from "@/utils/orgRedirect";
import type { DocsUrl } from "@/utils/types";

interface PostmanHotlinkPayload {
    postmanTeamId: string;
    intent: "edit" | "view";
}

function isValidPayload(payload: unknown): payload is PostmanHotlinkPayload {
    if (typeof payload !== "object" || payload == null) {
        return false;
    }
    const obj = payload as Record<string, unknown>;
    return (
        typeof obj.postmanTeamId === "string" &&
        obj.postmanTeamId.length > 0 &&
        (obj.intent === "edit" || obj.intent === "view")
    );
}

export default async function ViewDocsPage({
    params,
    searchParams
}: {
    params: Promise<{ docsUrl: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { docsUrl: encodedDocsUrl } = await params;
    const resolvedSearchParams = await searchParams;
    const token = typeof resolvedSearchParams.token === "string" ? resolvedSearchParams.token : undefined;
    const docsUrl = decodeURIComponent(encodedDocsUrl) as DocsUrl;
    const encodedUrl = constructDocsUrlParam(docsUrl);

    // Authenticate first — redirect to login if no session
    const session = await getCurrentSession();
    if (session == null) {
        // Preserve all query parameters in the return URL
        const returnSearchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(resolvedSearchParams)) {
            if (typeof value === "string") {
                returnSearchParams.set(key, value);
            } else if (Array.isArray(value)) {
                for (const v of value) {
                    returnSearchParams.append(key, v);
                }
            }
        }
        const queryString = returnSearchParams.toString();
        const returnUrl = `/view/${encodedDocsUrl}${queryString ? `?${queryString}` : ""}`;
        redirect(`/login?redirect_on_login=${encodeURIComponent(returnUrl)}`);
    }

    const userId = Auth0UserID(session.user.sub);

    // Track PostHog event for /view/docsUrl entry
    try {
        const posthog = getServerSidePosthog();
        posthog.capture({
            distinctId: userId,
            event: PosthogEventName.POSTMAN_VIEW_DOCS_ENTERED,
            properties: {
                docsUrl,
                hasToken: token != null
            }
        });
    } catch (error) {
        console.warn("[postman-view] Failed to capture PostHog event:", error);
    }

    // Step 1: Resolve the org that owns this docsUrl (uses FERN_TOKEN, no membership required)
    const orgName = await getOrgNameFromDocsUrl(docsUrl);

    if (!token) {
        // No token: redirect to dashboard if user already has access to the org
        if (orgName) {
            try {
                const isMember = await doesUserBelongToOrg(userId, orgName);
                if (isMember) {
                    redirect(`/${orgName}/docs/${encodedUrl}`);
                }
            } catch (error) {
                // Re-throw Next.js internal errors (e.g. NEXT_REDIRECT from redirect())
                if (typeof error === "object" && error !== null && "digest" in error) {
                    throw error;
                }
                console.error("[postman-view] Failed to check membership for docsUrl without token:", error);
            }
        }

        // User is not a member or org lookup failed; token is required for auto-add
        redirect("/login");
    }

    // Token flow: verify JWT and auto-add user to the org

    if (!orgName) {
        console.error("[postman-view] Could not resolve org from docsUrl, cannot proceed with token flow");
        redirect("/login");
    }

    // Step 2: Decode JWT without verifying to extract postmanTeamId for sharedSecret lookup
    const unverifiedPayload = jwt.decode(token);
    if (!isValidPayload(unverifiedPayload)) {
        console.error("[postman-view] Invalid JWT payload structure", unverifiedPayload);
        redirect("/login");
    }

    const { postmanTeamId } = unverifiedPayload;

    // Look up the app installation to get the sharedSecret
    const installation = await getAppInstallationByTeamId(postmanTeamId);
    if (!installation) {
        console.error(`[postman-view] No app installation found for team ${postmanTeamId}`);
        redirect("/login");
    }

    // Verify the JWT signature using the sharedSecret
    try {
        jwt.verify(token, installation.shared_secret, { algorithms: ["HS256"] });
    } catch (error) {
        console.error("[postman-view] JWT verification failed:", error);
        redirect("/login");
    }

    // Step 3: Add the user to the org via Auth0 management client (no membership required)
    const auth0OrgId = await getOrgIdFromName(orgName);
    try {
        await addUserToOrgById(userId, auth0OrgId);

        // Invalidate Redis caches so the org layout doesn't serve stale "user not in org" responses
        await invalidateCachesAfterAddingOrgMember(userId, orgName);

        // Invalidate Next.js cached permission checks for this user+org
        try {
            revalidateTag(`permissions:${orgName}:${userId}`);
        } catch {
            // revalidateTag may not be available in all contexts
        }

        console.log(
            `[postman-view] Auto-added user ${userId} to org ${orgName} (auth0: ${auth0OrgId}) for Postman team ${postmanTeamId}`
        );
    } catch (error) {
        // User may already be a member; log and continue to redirect
        console.warn(`[postman-view] Failed to add user to org (may already be a member):`, error);
    }

    // Step 4: Redirect through org-scoped auth so the session gets the correct org claims.
    // A direct redirect to /{orgName}/docs/{encodedUrl} would hit the [orgName] layout
    // before Auth0 propagates the new membership, causing a "no access" page.
    const docsPath = `/docs/${encodedUrl}`;
    redirect(orgRedirect({ id: auth0OrgId, name: orgName }, docsPath));
}

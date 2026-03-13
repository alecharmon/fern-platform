import { getEmailLoginConfig } from "@fern-docs/edge-config";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import getMyOrganizations from "@/app/api/get-my-organizations/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { consumeLoginAttempt } from "@/app/services/auth0/loginAttempts";
import { addUserToOrgById, invalidateCachesAfterAddingOrgMember } from "@/app/services/auth0/management";
import { Auth0OrgID, type Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import type { LoginAttempt } from "@/app/services/redis/cacheKey";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import orgRedirect from "@/utils/orgRedirect";
import type { EmailLoginSsoEntry } from "../../../../../../../fern-docs/edge-config/src/getEmailLoginConfig";
import { attemptGroupPermSync, attemptOrgLevelRole } from "./permission-sync";
import SilentReauthLoader from "./SilentReauthLoader";

function asString(value: string | string[] | undefined): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function logMissingLoginAttemptQueryParam(searchParams: Record<string, string | string[] | undefined>): void {
    console.error("Missing login attempt query param after SSO", { searchParams });
}

function failClosedProvisioning(error: unknown, orgId: string, userId: string): never {
    console.error("Failed to add user to org after SSO", {
        error,
        orgId,
        userId
    });
    redirect("/");
}

function dedupeOrgEntries(entries: EmailLoginSsoEntry[]): EmailLoginSsoEntry[] {
    return entries.filter((entry, index) => {
        return (
            entries.findIndex((candidate) => {
                return candidate.org_id === entry.org_id && candidate.org_name === entry.org_name;
            }) === index
        );
    });
}

async function getOrgSettingsForLoginAttemptOrRedirect(loginAttempt: LoginAttempt): Promise<EmailLoginSsoEntry> {
    const config = await getEmailLoginConfig();
    const configEntries = dedupeOrgEntries([
        ...Object.values(config.connectionToOrg),
        ...Object.values(config.byEmailDomain)
    ]);
    const mappedOrg = configEntries.find((entry) => {
        return entry.org_id === loginAttempt.orgId && entry.org_name === loginAttempt.orgName;
    });

    if (mappedOrg != null) {
        return mappedOrg;
    }

    console.error("Failed to resolve org settings for login attempt", {
        loginAttempt,
        configuredOrgs: configEntries.map((entry) => ({ orgId: entry.org_id, orgName: entry.org_name }))
    });
    redirect("/");
}

function isValidLoginAttempt(loginAttempt: LoginAttempt | undefined): loginAttempt is LoginAttempt {
    return (
        loginAttempt != null &&
        typeof loginAttempt.connection === "string" &&
        typeof loginAttempt.orgId === "string" &&
        typeof loginAttempt.orgName === "string" &&
        typeof loginAttempt.redirectPath === "string" &&
        loginAttempt.redirectPath.startsWith("/")
    );
}

export default async function PostSsoRedirectPage({
    searchParams
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedSearchParams = await searchParams;
    const loginAttemptId = asString(resolvedSearchParams.login_attempt);

    if (!loginAttemptId) {
        logMissingLoginAttemptQueryParam(resolvedSearchParams);
        redirect("/");
    }

    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    const loginAttempt = await consumeLoginAttempt(loginAttemptId);
    if (loginAttempt == null) {
        console.error("Missing or expired login attempt after SSO", { loginAttemptId });
        redirect("/");
    }

    if (!isValidLoginAttempt(loginAttempt)) {
        console.error("Invalid login attempt after SSO", { loginAttemptId, loginAttempt });
        redirect("/");
    }

    const orgSettings = await getOrgSettingsForLoginAttemptOrRedirect(loginAttempt);

    // Redirect with the stored post-login path.
    // Use silent: false because the user just authenticated via SSO and their
    // token isn't org-scoped yet — prompt=none fails for freshly provisioned users.
    const destination = orgRedirect({ id: loginAttempt.orgId, name: loginAttempt.orgName }, loginAttempt.redirectPath, {
        silent: false
    });

    const userId = Auth0UserID(session.user.sub);
    const orgId = Auth0OrgID(loginAttempt.orgId);

    try {
        const orgs = await getMyOrganizations(userId);
        const alreadyInOrg = orgs.some((org) => org.id === orgId);

        if (!alreadyInOrg) {
            const venus = getVenusClient({ token: session.accessToken ?? "" });

            await venus.organization.addUser({
                orgId,
                userId
            });

            await addUserToOrgById(userId, orgId);
            // Invalidate the cached org membership so the org layout doesn't
            // serve a stale "user not in org" response after the redirect.
            await invalidateCachesAfterAddingOrgMember(userId, loginAttempt.orgName);
            revalidateTag(`permissions:${loginAttempt.orgName as Auth0OrgName}:${userId}`);
        }
    } catch (error) {
        failClosedProvisioning(error, orgId, userId);
    }

    if (orgSettings.use_group_mappings) {
        await attemptGroupPermSync({ userId, orgId, connection: loginAttempt.connection });
    } else {
        await attemptOrgLevelRole({ userId, orgId, defaultRole: orgSettings.default_role });
    }

    // Show loading UI while polling for org-scoped token via silent re-auth
    // This handles the case where permissions were just synced but the token
    // doesn't yet reflect the org membership
    return <SilentReauthLoader orgId={orgId} destination={destination} />;
}

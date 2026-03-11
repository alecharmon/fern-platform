import { postToSlack } from "@fern-api/docs-server/slack";
import { type EmailLoginSupportedPlatform, getEmailLoginConfig } from "@fern-docs/edge-config";
import { NextResponse } from "next/server";
import z from "zod";
import { createLoginAttempt } from "@/app/services/auth0/loginAttempts";
import { type Auth0User, getAllUsersByEmail } from "@/app/services/auth0/management";
import { Auth0OrgID, Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import getMyOrganizations from "../../get-my-organizations/handler";

const RequestSchema = z.object({
    email: z.string().email(),
    redirect_on_login: z.string().optional()
});

type IdentityLike = {
    connection?: string;
    provider?: string;
};

type SupportedIdentity = {
    connection: string;
    provider: EmailLoginSupportedPlatform;
};

function normalizeRedirectPath(redirectOnLogin: string | undefined, defaultPath: string): string {
    if (typeof redirectOnLogin === "string" && redirectOnLogin.startsWith("/")) {
        return redirectOnLogin;
    }

    return defaultPath;
}

async function buildPostSsoNewUserRedirect(
    email: string,
    connection: string,
    orgId: string,
    orgName: string,
    redirectOnLogin: string | undefined
): Promise<string> {
    const defaultRedirect = "/";
    const loginAttemptId = await createLoginAttempt({
        email,
        connection,
        orgId: Auth0OrgID(orgId),
        orgName: Auth0OrgName(orgName),
        redirectPath: normalizeRedirectPath(redirectOnLogin, defaultRedirect)
    });

    return `/login/email/post-sso-redirect?${new URLSearchParams({ login_attempt: loginAttemptId }).toString()}`;
}

function isSupportedIdentity(
    identity: IdentityLike,
    providers: Set<EmailLoginSupportedPlatform>
): identity is SupportedIdentity {
    return (
        typeof identity.connection === "string" &&
        typeof identity.provider === "string" &&
        providers.has(identity.provider as EmailLoginSupportedPlatform)
    );
}

/**
 * Returns a sort priority for a provider - lower numbers come first.
 * Google and GitHub connections should be sorted last (higher priority number).
 */
function getProviderSortPriority(provider: string | undefined): number {
    if (provider === "google-oauth2" || provider === "github") {
        return 1; // Sort last
    }
    return 0; // Sort first (SSO/enterprise connections)
}

/**
 * Sorts users by their identity connections, with Google and GitHub connections last.
 * Users with enterprise SSO connections will be prioritized.
 */
function sortUsersByConnectionPriority(users: Auth0User[]): Auth0User[] {
    return [...users].sort((a, b) => {
        const aMinPriority = Math.min(
            ...(a.identities ?? []).map((id) => getProviderSortPriority(id.provider)),
            Infinity
        );
        const bMinPriority = Math.min(
            ...(b.identities ?? []).map((id) => getProviderSortPriority(id.provider)),
            Infinity
        );
        return aMinPriority - bMinPriority;
    });
}

/**
 * Sends a Slack alert when multiple Auth0 accounts are found for a single email.
 * This typically indicates duplicate accounts that should be consolidated.
 */
function alertDuplicateAccounts(email: string, users: Auth0User[]): void {
    const userDetails = users
        .map((u) => {
            const providers = (u.identities ?? []).map((id) => id.provider).join(", ");
            return `• \`${u.user_id}\` (${providers || "no identities"})`;
        })
        .join("\n");

    const ssoUser = users.find((u) =>
        (u.identities ?? []).some((id) => id.provider !== "google-oauth2" && id.provider !== "github")
    );
    const nonSsoUsers = users.filter((u) =>
        (u.identities ?? []).every((id) => id.provider === "google-oauth2" || id.provider === "github")
    );

    let recommendation = "";
    if (ssoUser && nonSsoUsers.length > 0) {
        const nonSsoIds = nonSsoUsers.map((u) => `\`${u.user_id}\``).join(", ");
        recommendation = `\n\n:warning: *Recommendation:* Keep SSO account \`${ssoUser.user_id}\` and delete non-SSO account(s): ${nonSsoIds}`;
    }

    postToSlack(
        "#dashboard-notifs",
        `:warning: *Duplicate accounts detected for email:* \`${email}\`\n\n*Found ${users.length} accounts:*\n${userDetails}${recommendation}`,
        "duplicate-account"
    );
}

function buildRedirectUrl(
    connection: string,
    email: string,
    redirectOnLogin: string | undefined,
    defaultPath: string
): string {
    const redirectPath = normalizeRedirectPath(redirectOnLogin, defaultPath);

    return `/auth/login?connection=${encodeURIComponent(
        connection
    )}&login_hint=${encodeURIComponent(email)}&redirect_on_login=${encodeURIComponent(redirectPath)}&prompt=select_account`;
}

function jsonRedirect(connection: string, email: string, redirectOnLogin: string | undefined, defaultPath: string) {
    return NextResponse.json({
        redirectUrl: buildRedirectUrl(connection, email, redirectOnLogin, defaultPath)
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, redirect_on_login } = RequestSchema.parse(body);

        const { supportedPlatforms, connectionToOrg, byEmailDomain } = await getEmailLoginConfig();
        const cleanedEmail = email.trim().toLowerCase();

        // Check for email domain mapping first - if present, always redirect to SSO
        const emailDomain = cleanedEmail.split("@")[1];
        if (emailDomain !== undefined && byEmailDomain[emailDomain] !== undefined) {
            const orgEntry = byEmailDomain[emailDomain]!;
            const postSsoRedirect = await buildPostSsoNewUserRedirect(
                cleanedEmail,
                orgEntry.connection,
                orgEntry.org_id,
                orgEntry.org_name,
                redirect_on_login
            );

            // Redirect to SSO login with post-SSO redirect to add them to the org if needed
            return jsonRedirect(orgEntry.connection, email, postSsoRedirect, `/${orgEntry.org_name}`);
        }

        const users = await getAllUsersByEmail(cleanedEmail);

        // Alert if multiple accounts exist for the same email
        if (users.length > 1) {
            alertDuplicateAccounts(cleanedEmail, users);
        }

        const sortedUsers = sortUsersByConnectionPriority(users);
        const user = sortedUsers[0];

        if (!user) {
            // No user found - check if email domain maps to a known social OAuth provider
            if (emailDomain === "postman.com") {
                return jsonRedirect("postman", email, redirect_on_login, "/");
            }
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        const providers = new Set<EmailLoginSupportedPlatform>(supportedPlatforms);

        const identities: SupportedIdentity[] = (user.identities ?? [])
            .filter((identity) => isSupportedIdentity(identity, providers))
            .map((identity) => ({
                connection: identity.connection!,
                provider: identity.provider
            }));

        // 1. Check if any identity has an explicit SSO → Org mapping.
        for (const identity of identities) {
            const orgEntry = connectionToOrg[identity.connection];
            if (!orgEntry) {
                continue;
            }

            const orgs = await getMyOrganizations(Auth0UserID(user.user_id));
            const alreadyInOrg = orgs.some((org) => org.id === Auth0OrgID(orgEntry.org_id));
            const defaultPath = `/${orgEntry.org_name}`;

            // Redirect through post-SSO flow when the user isn't in the mapped org yet
            if (!alreadyInOrg) {
                const postSsoRedirect = await buildPostSsoNewUserRedirect(
                    cleanedEmail,
                    identity.connection,
                    orgEntry.org_id,
                    orgEntry.org_name,
                    redirect_on_login
                );
                return jsonRedirect(identity.connection, email, postSsoRedirect, defaultPath);
            }

            // Existing member can go straight to the target path
            return jsonRedirect(identity.connection, email, redirect_on_login, defaultPath);
        }

        // 2. Fall back to first supported SSO identity (Google / GitHub) with default redirect.
        for (const identity of identities) {
            switch (identity.provider) {
                case "google-oauth2":
                case "github": {
                    return jsonRedirect(identity.connection, email, redirect_on_login, "/");
                }
            }
        }

        // If we got here, the user exists but has no supported SSO identities.
        return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    } catch (error) {
        console.error("Failed to resolve email SSO login", error);
        return NextResponse.json({ error: "unable_to_start_sso" }, { status: 400 });
    }
}

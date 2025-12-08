import { type EmailLoginSupportedPlatform, getEmailLoginConfig } from "@fern-docs/edge-config";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import z from "zod";
import { Auth0ManagementError, type Auth0User, getUserByEmail } from "@/app/services/auth0/management";
import { Auth0OrgID, Auth0UserID } from "@/app/services/auth0/types";
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

function buildPostSsoNewUserRedirect(connection: string, orgName: string, redirectOnLogin: string | undefined): string {
    const defaultRedirect = `/${orgName}`;
    const searchParams = new URLSearchParams({
        connection,
        default_redirect: defaultRedirect,
        redirect: normalizeRedirectPath(redirectOnLogin, defaultRedirect)
    });

    return `/login/email/post-sso-redirect?${searchParams.toString()}`;
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

        let user: Auth0User | undefined;
        try {
            user = await getUserByEmail(cleanedEmail);
        } catch (error) {
            if (error instanceof Auth0ManagementError && error.errorCode === "MULTIPLE_USERS_FOUND") {
                Sentry.captureException(error);
                return NextResponse.json({ error: "multiple_users_found" }, { status: 409 });
            } else {
                throw error;
            }
        }

        if (!user) {
            // No user found - check for default email domain mapping
            const emailDomain = cleanedEmail.split("@")[1];
            if (emailDomain === undefined || byEmailDomain[emailDomain] === undefined) {
                return NextResponse.json({ error: "user_not_found" }, { status: 404 });
            }

            const orgEntry = byEmailDomain[emailDomain]!;
            const postSsoRedirect = buildPostSsoNewUserRedirect(
                orgEntry.connection,
                orgEntry.org_name,
                redirect_on_login
            );

            // Since its the user's first time logging in, we redirect to the SSO login with a post-SO redirect to add them to the org
            return jsonRedirect(orgEntry.connection, email, postSsoRedirect, `/${orgEntry.org_name}`);
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
                const postSsoRedirect = buildPostSsoNewUserRedirect(
                    identity.connection,
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

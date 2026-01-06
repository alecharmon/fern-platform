import { addRoles, getRoles } from "@fern-api/user-permissions";
import { getEmailLoginConfig } from "@fern-docs/edge-config";
import { redirect } from "next/navigation";
import z from "zod";
import getMyOrganizations from "@/app/api/get-my-organizations/handler";
import { getAuth0Client } from "@/app/services/auth0/auth0";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { addUserToOrgById } from "@/app/services/auth0/management";
import { Auth0OrgID, Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import orgRedirect from "@/utils/orgRedirect";

const QuerySchema = z.object({
    connection: z.string(),
    redirect: z.string().optional(),
    default_redirect: z.string().optional()
});

function ensureRedirectPath(path: string | undefined, fallback: string): string {
    if (typeof path === "string" && path.startsWith("/")) {
        return path;
    }

    return fallback;
}

function asString(value: string | string[] | undefined): string | undefined {
    return typeof value === "string" ? value : undefined;
}

type OrgMapping = {
    org_id: string;
    org_name: string;
};

async function getOrgForConnection(connection: string): Promise<OrgMapping | undefined> {
    const { connectionToOrg, byEmailDomain } = await getEmailLoginConfig();
    const mappedOrg = connectionToOrg[connection];
    if (mappedOrg != null) {
        return mappedOrg;
    }

    return Object.values(byEmailDomain).find((entry) => entry.connection === connection);
}

export default async function PostSsoRedirectPage({
    searchParams
}: {
    searchParams: Record<string, string | string[] | undefined>;
}) {
    const parsed = QuerySchema.safeParse({
        connection: asString(searchParams.connection),
        redirect: asString(searchParams.redirect),
        default_redirect: asString(searchParams.default_redirect)
    });

    if (!parsed.success) {
        redirect("/");
    }

    const { connection, redirect: redirectParam, default_redirect } = parsed.data;

    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    const orgMapping = await getOrgForConnection(connection);
    const fallbackRedirect = ensureRedirectPath(default_redirect, "/");
    if (!orgMapping) {
        console.error("Failed to resolve org for connection", { connection });
        redirect(ensureRedirectPath(redirectParam, fallbackRedirect));
    }

    const orgDefaultRedirect = ensureRedirectPath(default_redirect ?? `/${orgMapping.org_name}`, "/");
    const destination = ensureRedirectPath(redirectParam, orgDefaultRedirect);

    const userId = Auth0UserID(session.user.sub);
    const orgId = Auth0OrgID(orgMapping.org_id);

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
        }
    } catch (error) {
        console.error("Failed to add user to org after SSO", {
            error,
            orgId,
            userId
        });
    }

    const currentRoles = await getRoles({ userId: userId, orgId: orgId });
    if (currentRoles.ok!) {
        console.error("Failed to check sso roles", {
            orgId,
            userId
        });
    }

    if (currentRoles.data.length === 0) {
        // Add default roles
        const addRoleResult = await addRoles({
            userId: userId,
            orgId: orgId,
            // for now these are admin roles but will be downgraded
            // to viewer at some point
            roleNames: ["admin", "cli"]
        });

        if (addRoleResult.ok === false) {
            // Attempt to continue anyways
            console.error("Failed to add roles to user", {
                orgId,
                userId
            });
        }
        const auth0 = await getAuth0Client();
        await auth0.getAccessToken({ refresh: true });

        redirect(
            orgRedirect({
                name: Auth0OrgName(orgMapping.org_name),
                id: Auth0OrgID(orgMapping.org_id)
            })
        );
    }

    redirect(destination);
}

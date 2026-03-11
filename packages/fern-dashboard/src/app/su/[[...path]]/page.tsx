import { isSuperUser } from "@fern-api/user-permissions";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { createIsFernOrgMemberChecker, FERN_ORG_NAME, getOrgIdFromName } from "@/app/services/auth0/management";

/**
 * /su/ route — "super-user" re-authentication.
 *
 * When a user navigates to /su/ (or /su/<org>/<path>), this page re-authenticates
 * them using their own user-level permissions/roles (via the Fern org) rather than
 * the org-scoped roles they may currently hold.
 *
 * Flow:
 *  1. If not logged in → redirect to /login
 *  2. If already a super-user → redirect to the target path (strip /su/ prefix)
 *  3. If a Fern org member → redirect through Auth0 login scoped to the Fern org
 *  4. Otherwise → redirect to / (user is not eligible for super-user access)
 */
export default async function SuperUserPage({
    params
}: Readonly<{
    params: Promise<{ path?: string[] }>;
}>) {
    const { path } = await params;
    const targetPath = path ? `/${path.join("/")}` : "/";

    const session = await getCurrentSession();

    if (session == null) {
        redirect(`/login?redirect_on_login=${encodeURIComponent(`/su${targetPath}`)}`);
    }

    const permissions: string[] = session.permissions ?? [];

    // Already has super-user permissions — go straight to the target path
    if (isSuperUser(permissions)) {
        redirect(targetPath);
    }

    // Check if the user is a Fern org member (eligible for super-user)
    const isFernOrgMember = await createIsFernOrgMemberChecker();
    if (isFernOrgMember(session.user.sub)) {
        const fernOrgId = await getOrgIdFromName(FERN_ORG_NAME);

        const searchParams = new URLSearchParams({
            redirect_on_login: targetPath,
            organization: fernOrgId,
            scope: "openid profile email offline_access"
        });

        if (process.env.NEXT_PUBLIC_VENUS_AUDIENCE) {
            searchParams.set("audience", process.env.NEXT_PUBLIC_VENUS_AUDIENCE);
        }

        redirect(`/auth/login?${searchParams.toString()}`);
    }

    // Not a Fern org member — redirect to home
    redirect("/");
}

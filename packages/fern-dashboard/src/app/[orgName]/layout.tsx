import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { createIsFernOrgMemberChecker, FERN_ORG_NAME, getOrgIdFromName } from "@/app/services/auth0/management";
import { getAvailableOrgsForUser } from "@/app/services/dal/fdr/getAvailableOrgsForUser";
import { TokenRefresher } from "@/components/auth/TokenRefresher";
import { OrgNotFoundLayout } from "@/components/layout/OrgNotFoundLayout";
import orgRedirect from "@/utils/orgRedirect";
import type { Auth0OrgName } from "../services/auth0/types";

export default async function OrgLayout({
    params,
    children
}: Readonly<{
    params: Promise<{ orgName: Auth0OrgName }>;
    children: React.ReactNode;
}>) {
    const { orgName } = await params;
    const session = await getCurrentSession();

    // Get the current path to check if this is the edit-page route
    const headersList = await headers();
    const currentPath = headersList.get("x-current-path") ?? "";
    const isEditPage = currentPath.includes("/edit-page");

    const permissions: string[] = session?.permissions ?? [];
    // Check if user has access to this org (works even if not authenticated)
    if (session && !permissions.includes("super-user")) {
        const organizations = await getAvailableOrgsForUser({
            userId: session.user.sub
        });

        const targetOrg = organizations.find((org) => org.name === orgName);
        // User doesn't have access to this org
        if (!targetOrg) {
            // Check if the user is a super-user (fern org member) whose token isn't
            // org-scoped yet (e.g., after a fresh login redirected to a non-member org
            // via localStorage recent org). In this case, redirect them to re-auth with
            // the fern org so the JWT gets the "super-user" permission.
            const isFernEmployee = await createIsFernOrgMemberChecker();
            if (isFernEmployee(session.user.sub)) {
                const fernOrgId = await getOrgIdFromName(FERN_ORG_NAME);
                const pathname = currentPath.replace(`/${orgName}`, "");
                redirect(orgRedirect({ id: fernOrgId, name: orgName }, pathname));
            }

            console.warn("[org] Org Id not found", targetOrg);
            // For edit-page, let the page handle non-members (redirect to fallback URL)
            if (!isEditPage) {
                return <OrgNotFoundLayout orgName={orgName} />;
            }
        }

        // Session is scoped to a different org (or no org) - re-auth for the correct org
        if (targetOrg && session.orgId !== targetOrg.id) {
            console.warn("[org] Session Org ID no Equal to Page Route Org", targetOrg.id, session.orgId);
            // Remove the org prefix since orgRedirect adds it back
            const pathname = currentPath.replace(`/${orgName}`, "");
            redirect(orgRedirect({ id: targetOrg.id, name: orgName }, pathname));
        }
    }

    return (
        <>
            {session && <TokenRefresher />}
            {children}
        </>
    );
}

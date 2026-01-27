import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
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

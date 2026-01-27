import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { isFernEmployee } from "@/app/services/auth0/management";
import type { Auth0Organization, Auth0OrgName } from "@/app/services/auth0/types";
import { getAvailableOrgsForUser } from "@/app/services/dal/fdr/getAvailableOrgsForUser";

import { OrgSwitcherClient } from "./OrgSwitcherClient";

export const revalidate = 0;

export async function OrgSwitcher({ currentOrgName }: { currentOrgName?: Auth0OrgName }) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    let organizations: Auth0Organization[] = [];
    try {
        organizations = await getAvailableOrgsForUser({
            userId: session.user.sub
        });
    } catch (error) {
        console.error("Failed to load organizations", error);
        return null;
    }

    const isFernAdmin = isFernEmployee(session.permissions ?? []);

    return (
        <OrgSwitcherClient
            organizations={organizations}
            currentOrgName={currentOrgName}
            isFernAdmin={isFernAdmin}
            accessToken={session.accessToken}
            userId={session.user.sub}
        />
    );
}

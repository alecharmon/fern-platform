"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getMostRecentOrg } from "@/utils/recentOrgs";

export function RecentOrgRedirect({
    defaultOrgName,
    userId,
    targetPath = "/docs"
}: {
    defaultOrgName: Auth0OrgName;
    userId: string;
    /** The path to append after the org name (e.g. "/docs", "/billing"). Defaults to "/docs". */
    targetPath?: string;
}) {
    const router = useRouter();

    useEffect(() => {
        // Check if there's a more recent org in localStorage for this user
        const recentOrg = getMostRecentOrg(userId);

        if (recentOrg) {
            // Redirect to the most recent org
            router.replace(`/${recentOrg}${targetPath}`);
        } else {
            // Otherwise use the default org
            router.replace(`/${defaultOrgName}${targetPath}`);
        }
    }, [defaultOrgName, router, userId, targetPath]);

    return null;
}

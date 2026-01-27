"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getMostRecentOrg } from "@/utils/recentOrgs";

export function RecentOrgRedirect({ defaultOrgName, userId }: { defaultOrgName: Auth0OrgName; userId: string }) {
    const router = useRouter();

    useEffect(() => {
        // Check if there's a more recent org in localStorage for this user
        const recentOrg = getMostRecentOrg(userId);

        if (recentOrg) {
            // Redirect to the most recent org
            router.replace(`/${recentOrg}/docs`);
        } else {
            // Otherwise use the default org
            router.replace(`/${defaultOrgName}/docs`);
        }
    }, [defaultOrgName, router, userId]);

    return null;
}

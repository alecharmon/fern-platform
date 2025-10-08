"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getMostRecentOrg } from "@/utils/recentOrgs";

export function RecentOrgRedirect({ defaultOrgName }: { defaultOrgName: Auth0OrgName }) {
    const router = useRouter();

    useEffect(() => {
        // Check if there's a more recent org in localStorage
        const recentOrg = getMostRecentOrg();

        if (recentOrg) {
            // Redirect to the most recent org
            router.replace(`/${recentOrg}/docs`);
        } else {
            // Otherwise use the default org
            router.replace(`/${defaultOrgName}/docs`);
        }
    }, [defaultOrgName, router]);

    return null;
}

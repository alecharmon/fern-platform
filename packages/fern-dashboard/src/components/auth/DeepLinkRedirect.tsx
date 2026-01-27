"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getMostRecentOrg } from "@/utils/recentOrgs";

export function DeepLinkRedirect({
    defaultOrgName,
    targetPath,
    userId
}: {
    defaultOrgName: Auth0OrgName;
    targetPath: string;
    userId: string;
}) {
    const router = useRouter();

    useEffect(() => {
        const recentOrg = getMostRecentOrg(userId);
        const orgName = recentOrg ?? defaultOrgName;
        router.replace(`/${orgName}${targetPath}`);
    }, [defaultOrgName, targetPath, router, userId]);

    return null;
}

"use client";

import { useEffect } from "react";

import { useRouter } from "@bprogress/next/app";
import { Loader2 } from "lucide-react";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import Redirect from "@/components/Redirect";

interface AcceptInviteSuccessProps {
    orgName: Auth0OrgName;
    userId: Auth0UserID;
}

export default function AcceptInviteSuccess({ orgName, userId }: AcceptInviteSuccessProps) {
    const router = useRouter();

    useEffect(() => {
        const handleRevalidation = async () => {
            router.refresh();
        };
        void handleRevalidation();
    }, [userId, orgName, router]);

    return (
        <>
            <div className="text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting...
            </div>
            <Redirect href={`/${orgName}/docs`} />
        </>
    );
}

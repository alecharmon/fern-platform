"use client";

import * as Sentry from "@sentry/nextjs";
import { useParams } from "next/navigation";
import type React from "react";
import { useEffect } from "react";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";

export declare namespace SentryUserProvider {
    export interface Props {
        session: Auth0SessionData | undefined;
        children: React.JSX.Element;
    }
}

export function SentryUserProvider({ session, children }: SentryUserProvider.Props) {
    const params = useParams();

    // Prefer orgName from the session token; fall back to URL params
    const orgName = session?.orgName ?? (params?.orgName as Auth0OrgName | undefined);

    useEffect(() => {
        const userId = session?.user?.sub;
        const userEmail = session?.user?.email;

        if (userId != null || userEmail != null) {
            Sentry.setUser({ id: userId, email: userEmail });
        } else {
            Sentry.setUser(null);
        }

        Sentry.setTag("userEmail", userEmail ?? undefined);
        Sentry.setTag("orgName", orgName ?? undefined);
    }, [session?.user?.email, session?.user?.sub, orgName]);

    return <>{children}</>;
}

"use client";

import * as Sentry from "@sentry/nextjs";
import type React from "react";
import { useEffect } from "react";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { isProduction } from "@/utils/environment";

export declare namespace SentryUserProvider {
    export interface Props {
        session: Auth0SessionData | undefined;
        children: React.JSX.Element;
    }
}

export function SentryUserProvider({ session, children }: SentryUserProvider.Props) {
    useEffect(() => {
        if (!isProduction()) {
            return;
        }

        if (session?.user?.email != null) {
            Sentry.setTag("userEmail", session.user.email);
        } else {
            Sentry.setTag("userEmail", undefined);
        }
    }, [session?.user?.email]);

    return <>{children}</>;
}

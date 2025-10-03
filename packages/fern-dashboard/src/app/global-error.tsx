"use client";

import { useEffect } from "react";

import { isProduction } from "@/utils/environment";

import ErrorPage from "./error";

export default function GlobalError({ error }: { error: Error }) {
    // Global error boundary requires manual capture as the last resort
    // for any unhandled client-side errors that bypass automatic Sentry integration
    useEffect(() => {
        if (!isProduction()) {
            return;
        }

        void import("@sentry/nextjs").then((module) => module.captureException(error));
    }, [error]);

    return (
        <html>
            <body>
                <ErrorPage error={error} />
            </body>
        </html>
    );
}

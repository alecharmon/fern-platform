"use client";

import { useEffect } from "react";

import { isProductionDeployment } from "@/utils/environment";

import ErrorPage from "./error";

export default function GlobalError({ error }: { error: Error }) {
    // Global error boundary requires manual capture as the last resort
    // for any unhandled client-side errors that bypass automatic Sentry integration
    useEffect(() => {
        if (!isProductionDeployment()) {
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

"use client";

import GradientExclamation from "@fern-docs/components/GradientExclamation";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import ReturnHomeButton from "@/components/ReturnHomeButton";

export default function Error({ error }: { error: Error & { digest?: string } }) {
    // React Error Boundaries require manual Sentry integration because
    // Sentry's automatic client-side capture doesn't extend to caught React errors
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <div className="flex h-24 w-24 items-center justify-center">
                <GradientExclamation colors={["var(--gray-500)", "var(--gray-800)", "var(--gray-1000)"]} />
            </div>
            <div className="flex flex-col text-center">
                <div className="mb-2 text-2xl font-bold">We&apos;ve encountered an error!</div>
                <p className="text-(color:--gray-900) mb-8 text-sm">
                    Please try again. If the problem persists, contact support.
                </p>
            </div>

            <div className="flex gap-2">
                <LogoutButton />
                <ReturnHomeButton />
            </div>
        </div>
    );
}

"use client";

import GradientExclamation from "@fern-docs/components/GradientExclamation";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { ERROR_DIGEST_KEYS } from "@/utils/errors";
import { ERROR_DIGEST_MESSAGES } from "@/utils/errors";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    // React Error Boundaries require manual Sentry integration because
    // Sentry's automatic client-side capture doesn't extend to caught React errors
    // Only report unexpected errors (UNEXPECTED_ERROR digest or no digest at all)
    // to avoid spamming Sentry/Slack with expected user-facing errors
    useEffect(() => {
        const isUnexpectedError = !error.digest || (error.digest as ERROR_DIGEST_KEYS) === "UNEXPECTED_ERROR";
        if (isUnexpectedError) {
            Sentry.captureException(error);
        }
    }, [error]);

    const { orgName } = useParams();

    return (
        <main className="flex h-full w-full items-center justify-center">
            <div className="flex max-w-[500px] flex-col items-center justify-center gap-6 text-center">
                <div className="flex h-24 w-24 items-center justify-center">
                    <GradientExclamation colors={["var(--gray-500)", "var(--gray-800)", "var(--gray-1000)"]} />
                </div>
                <h2 className="text-muted-foreground">
                    {ERROR_DIGEST_MESSAGES[error.digest as ERROR_DIGEST_KEYS] || "Unknown error occurred."}
                </h2>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href={`/${orgName}/docs`}>Return home</Link>
                    </Button>
                    <Button variant="outline" onClick={reset}>
                        Try again
                    </Button>
                </div>
            </div>
        </main>
    );
}

"use client";

import { SemanticBadge } from "@fern-docs/components/badges/semantic-badge";
import { GradientErrorPage } from "@fern-docs/components/error-pages/GradientErrorPage";
import { t } from "@fern-docs/i18n";
import * as Sentry from "@sentry/nextjs";
import { RefreshCcw } from "lucide-react";
import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const lang = "en";

    useEffect(() => {
        // Log error to console
        console.error(`[error-boundary] ${JSON.stringify(error)}`);

        // Track error to Sentry with additional context
        Sentry.captureException(error, {
            tags: {
                errorBoundary: "bundle",
                digest: error.digest
            },
            contexts: {
                errorInfo: {
                    message: error.message,
                    stack: error.stack,
                    digest: error.digest
                }
            }
        });
    }, [error]);

    return (
        <GradientErrorPage title={t(lang).errors.somethingWentWrong} subtitle={t(lang).feedback.weHaveBeenNotified}>
            <SemanticBadge
                variant="subtle"
                intent="error"
                rounded
                onClick={reset}
                interactive
                className="flex w-fit cursor-pointer"
            >
                {t(lang).buttons.clickToRefresh}
                <RefreshCcw className="size-4" />
            </SemanticBadge>
        </GradientErrorPage>
    );
}

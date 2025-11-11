"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { UnsupportedContentDisplayOnly } from "@/components/editor/UnsupportedContent";
import type { ERROR_DIGEST_KEYS } from "@/utils/errors";

export default function Error({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    // React Error Boundaries require manual Sentry integration because
    // Sentry's automatic client-side capture doesn't extend to caught React errors
    // Only report unexpected errors (UNEXPECTED_ERROR digest or no digest at all)
    useEffect(() => {
        const isUnexpectedError = !error.digest || (error.digest as ERROR_DIGEST_KEYS) === "UNEXPECTED_ERROR";
        if (isUnexpectedError) {
            Sentry.captureException(error);
        }
    }, [error]);

    // TODO: We should make this error message more specific to the error thrown. Right now this
    // is a catch-all for any error that occurs in the editor's markdown page.
    return (
        <div className="w-content-width mx-auto mt-12">
            <div>
                <UnsupportedContentDisplayOnly>
                    This file contains markdown that is not yet readable by the editor.
                </UnsupportedContentDisplayOnly>
            </div>
        </div>
    );
}

"use client";

import { ErrorBoundaryFallback } from "@/components/error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    console.error(`[error-boundary] ${JSON.stringify(error)}`);
    return <ErrorBoundaryFallback error={error} resetErrorBoundary={reset} />;
}

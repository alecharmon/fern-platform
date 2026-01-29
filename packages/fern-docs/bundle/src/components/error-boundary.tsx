"use client";

import { SemanticBadge } from "@fern-docs/components/badges/semantic-badge";
import { cn } from "@fern-docs/components/cn";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import { RefreshCcw } from "lucide-react";
import type React from "react";
import type { PropsWithChildren } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

interface ChunkLoadError extends Error {
    name: "ChunkLoadError";
    type?: string;
    request?: string;
}

function isChunkLoadError(error: Error): error is ChunkLoadError {
    return (
        error.name === "ChunkLoadError" ||
        (error.message?.includes("Loading chunk") && error.message.includes("failed"))
    );
}

function handlePageReload(): void {
    window.location.reload();
}

export function ErrorBoundaryFallback({
    className,
    error,
    resetErrorBoundary,
    lang
}: {
    className?: string;
    error: Error & { digest?: string };
    resetErrorBoundary?: () => void;
    lang: string;
}) {
    console.error(`[error-boundary-fallback] ${JSON.stringify(error)}`);

    const isChunkError = isChunkLoadError(error);

    const errorBadge = (
        <SemanticBadge
            variant="subtle"
            intent="error"
            rounded
            onClick={isChunkError ? handlePageReload : resetErrorBoundary}
            interactive={isChunkError || resetErrorBoundary != null}
            className="m-auto flex w-fit"
        >
            {t(lang).errors.somethingWentWrong}
            {(isChunkError || resetErrorBoundary != null) && <RefreshCcw />}
        </SemanticBadge>
    );
    return (
        <div className={cn("size-full py-2", className)}>
            {isChunkError || resetErrorBoundary != null ? (
                <FernTooltipProvider>
                    <FernTooltip content={t(lang).buttons.clickToRefresh}>{errorBadge}</FernTooltip>
                </FernTooltipProvider>
            ) : (
                errorBadge
            )}
        </div>
    );
}

export function ErrorBoundary({
    children,
    onResetAction,
    fallback,
    lang = "en"
}: PropsWithChildren<{
    onResetAction?: () => void;
    fallback?: React.ReactNode;
    lang?: string;
}>) {
    if (fallback != null) {
        return (
            <ReactErrorBoundary
                onError={(error) => {
                    console.error(`[error-boundary]: ${error.message}`);
                }}
                fallback={fallback}
            >
                {children}
            </ReactErrorBoundary>
        );
    }

    return (
        <ReactErrorBoundary
            onReset={onResetAction}
            FallbackComponent={(props) => <ErrorBoundaryFallback {...props} lang={lang} />}
        >
            {children}
        </ReactErrorBoundary>
    );
}

export function withErrorBoundary<T extends React.ComponentType<any>>(Component: T, fallback?: React.ReactNode) {
    return function WithErrorBoundary(props: React.ComponentProps<T>) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}

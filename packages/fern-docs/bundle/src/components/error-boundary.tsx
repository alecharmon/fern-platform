"use client";

import { SemanticBadge } from "@fern-docs/components/badges/semantic-badge";
import { cn } from "@fern-docs/components/cn";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { RefreshCcw } from "lucide-react";
import type React from "react";
import type { PropsWithChildren } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

import { i18n } from "@/constants";

export function ErrorBoundaryFallback({
    className,
    error,
    resetErrorBoundary
}: {
    className?: string;
    error: Error & { digest?: string };
    resetErrorBoundary?: () => void;
}) {
    console.error(`[error-boundary-fallback] ${JSON.stringify(error)}`);
    const errorBadge = (
        <SemanticBadge
            variant="subtle"
            intent="error"
            rounded
            onClick={resetErrorBoundary}
            interactive={resetErrorBoundary != null}
            className="m-auto flex w-fit"
        >
            {i18n.errors.somethingWentWrong}
            {resetErrorBoundary != null && <RefreshCcw />}
        </SemanticBadge>
    );
    return (
        <div className={cn("size-full py-2", className)}>
            {resetErrorBoundary != null ? (
                <FernTooltipProvider>
                    <FernTooltip content={i18n.buttons.clickToRefresh}>{errorBadge}</FernTooltip>
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
    fallback
}: PropsWithChildren<{
    onResetAction?: () => void;
    fallback?: React.ReactNode;
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
        <ReactErrorBoundary onReset={onResetAction} FallbackComponent={ErrorBoundaryFallback}>
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

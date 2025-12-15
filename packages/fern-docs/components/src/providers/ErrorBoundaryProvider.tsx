"use client";

import type React from "react";
import { createContext, Fragment, useContext } from "react";

/**
 * Type for a component that wraps children in an error boundary.
 * This allows consuming apps (like bundle) to inject their own error boundary implementation.
 */
type ErrorBoundaryComponent = React.ComponentType<{ children: React.ReactNode }>;

/**
 * Context for providing an error boundary component to shared components.
 * Defaults to Fragment (no-op) if no provider is configured.
 */
const ErrorBoundaryContext = createContext<ErrorBoundaryComponent>(Fragment);

/**
 * Provider for injecting a custom error boundary implementation into shared components.
 *
 * Usage in consuming app (e.g., bundle):
 * ```tsx
 * import { ErrorBoundaryProvider } from "@fern-docs/components/providers/ErrorBoundaryProvider";
 * import { ErrorBoundary } from "@/components/error-boundary";
 *
 * <ErrorBoundaryProvider ErrorBoundary={ErrorBoundary}>
 *   {children}
 * </ErrorBoundaryProvider>
 * ```
 *
 * Shared components will then automatically use the provided error boundary.
 */
export function ErrorBoundaryProvider({
    ErrorBoundary,
    children
}: {
    ErrorBoundary: ErrorBoundaryComponent;
    children: React.ReactNode;
}) {
    return <ErrorBoundaryContext.Provider value={ErrorBoundary}>{children}</ErrorBoundaryContext.Provider>;
}

/**
 * Hook to get the error boundary component from context.
 * Returns Fragment if no ErrorBoundaryProvider is configured (safe no-op fallback).
 *
 * Usage in shared components:
 * ```tsx
 * function MyComponent({ children }) {
 *   const ErrorBoundary = useErrorBoundary();
 *   return <ErrorBoundary>{children}</ErrorBoundary>;
 * }
 * ```
 */
export function useErrorBoundary(): ErrorBoundaryComponent {
    return useContext(ErrorBoundaryContext);
}

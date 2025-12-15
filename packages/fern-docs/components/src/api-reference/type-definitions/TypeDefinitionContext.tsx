"use client";

import { slugToHref } from "@fern-api/docs-utils";
import type { TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import React, { createContext, useContext, useMemo } from "react";
import { useCurrentAnchor } from "../../hooks/use-anchor";
import { useCurrentPathname } from "../../hooks/use-current-pathname";
import { useErrorBoundary } from "../../providers/ErrorBoundaryProvider";

import type { JsonPropertyPath, JsonPropertyPathPart } from "../examples/JsonPropertyPath";

interface TypeDefinitionContextValue {
    types: Record<string, TypeDefinition>;
    isRootTypeDefinition: boolean;
    jsonPropertyPath: JsonPropertyPath;
    isResponse: boolean | undefined;
    slug: string;
    anchorIdParts: readonly string[];
    collapsible: boolean;
    isWidthConstrained: boolean;
    setIsWidthConstrained?: (value: boolean) => void;
}

export const TypeDefinitionContext = createContext<() => TypeDefinitionContextValue>(() => {
    throw new Error("TypeDefinitionContext.Provider not found in tree");
});

export function useTypeDefinitionContext(): TypeDefinitionContextValue {
    return useContext(TypeDefinitionContext)();
}

export function useOptionalTypeDefinitionContext(): TypeDefinitionContextValue | undefined {
    const contextFn = useContext(TypeDefinitionContext);
    try {
        return contextFn();
    } catch {
        return undefined;
    }
}

export function TypeDefinitionRoot({
    children,
    types,
    slug
}: {
    children: React.ReactNode;
    types: Record<string, TypeDefinition>;
    slug: string;
}) {
    const [isWidthConstrained, setIsWidthConstrained] = React.useState(false);
    const ErrorBoundary = useErrorBoundary();

    const contextValue = useMemo(
        () => ({
            isRootTypeDefinition: true,
            jsonPropertyPath: [],
            isResponse: undefined,
            types,
            slug,
            anchorIdParts: [],
            collapsible: false,
            isWidthConstrained,
            setIsWidthConstrained
        }),
        [types, slug, isWidthConstrained]
    );

    return (
        <ErrorBoundary>
            <TypeDefinitionContext.Provider value={useMemo(() => () => contextValue, [contextValue])}>
                {children}
            </TypeDefinitionContext.Provider>
        </ErrorBoundary>
    );
}

export function TypeDefinitionPathPart({ children, part }: { children: React.ReactNode; part: JsonPropertyPathPart }) {
    const parentContextFn = React.useContext(TypeDefinitionContext);
    const contextValue = React.useMemo(
        () => () => {
            const parent = parentContextFn();
            return {
                ...parent,
                isRootTypeDefinition: false,
                jsonPropertyPath: [...parent.jsonPropertyPath, part]
            };
        },
        [parentContextFn, part]
    );

    return <TypeDefinitionContext.Provider value={contextValue}>{children}</TypeDefinitionContext.Provider>;
}

export function TypeDefinitionAnchorPart({ children, part }: { children: React.ReactNode; part: string }) {
    const parentContextFn = React.useContext(TypeDefinitionContext);
    const anchorPart = part.replaceAll(" ", "-");
    const contextValue = React.useMemo(
        () => () => {
            const parent = parentContextFn();
            return {
                ...parent,
                anchorIdParts: [...parent.anchorIdParts, anchorPart] as const
            };
        },
        [parentContextFn, anchorPart]
    );

    return <TypeDefinitionContext.Provider value={contextValue}>{children}</TypeDefinitionContext.Provider>;
}

export function TypeDefinitionResponse({ children }: { children: React.ReactNode }) {
    const parentContextFn = React.useContext(TypeDefinitionContext);
    const contextValue = React.useMemo(
        () => () => {
            const parent = parentContextFn();
            return {
                ...parent,
                isResponse: true
            };
        },
        [parentContextFn]
    );

    return <TypeDefinitionContext.Provider value={contextValue}>{children}</TypeDefinitionContext.Provider>;
}

export function TypeDefinitionCollapsible({ children }: { children: React.ReactNode }) {
    const parent = useTypeDefinitionContext();
    const parentContextFn = React.useContext(TypeDefinitionContext);
    const contextValue = React.useMemo(
        () => () => {
            const parent = parentContextFn();
            return {
                ...parent,
                collapsible: true
            };
        },
        [parentContextFn]
    );

    if (parent.collapsible) {
        return children;
    }

    return <TypeDefinitionContext.Provider value={contextValue}>{children}</TypeDefinitionContext.Provider>;
}

export function TypeDefinitionUncollapsible({ children }: { children: React.ReactNode }) {
    const parent = useTypeDefinitionContext();
    const parentContextFn = React.useContext(TypeDefinitionContext);
    const contextValue = React.useMemo(
        () => () => {
            const parent = parentContextFn();
            return {
                ...parent,
                collapsible: false
            };
        },
        [parentContextFn]
    );

    if (parent.collapsible) {
        return children;
    }

    return <TypeDefinitionContext.Provider value={contextValue}>{children}</TypeDefinitionContext.Provider>;
}

export function useTypeDefinition(id: string) {
    const context = useTypeDefinitionContext();
    return context.types[id];
}

export function useAnchorId(): string | null {
    const { anchorIdParts } = useTypeDefinitionContext();
    return anchorIdParts.length > 0 ? anchorIdParts.join(".") : null;
}

export function useHref(): string {
    const { slug, anchorIdParts } = useTypeDefinitionContext();
    return `${slugToHref(slug)}${anchorIdParts.length > 0 ? `#${anchorIdParts.join(".")}` : ""}`;
}

export function useIsActive(): boolean {
    const currentPathname = useCurrentPathname();
    const currentAnchor = useCurrentAnchor();
    const currentHref = `${currentPathname}${currentAnchor ? `#${currentAnchor}` : ""}`;
    const href = useHref();
    return currentHref === href;
}

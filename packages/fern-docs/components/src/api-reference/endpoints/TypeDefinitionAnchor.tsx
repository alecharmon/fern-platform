"use client";

import { slugToHref } from "@fern-api/docs-utils";
import { isomorphicRequestIdleCallback } from "@fern-ui/react-commons";
import React from "react";
import { cn } from "../../cn";
import { FernAnchor } from "../../FernAnchor";

import {
    useIsActive,
    useOptionalTypeDefinitionContext,
    useTypeDefinitionContext
} from "../type-definitions/TypeDefinitionContext";

export function TypeDefinitionAnchor({ children, sideOffset }: { children: React.ReactNode; sideOffset?: number }) {
    const context = useOptionalTypeDefinitionContext();

    const handlePointerEnter = React.useCallback(() => {
        if (context?.slug != null) {
            window.dispatchEvent(
                new CustomEvent(`property-hover-on:${context.slug}:${context.isResponse ? "response" : "request"}`, {
                    detail: context.jsonPropertyPath
                })
            );
        }
    }, [context]);

    const handlePointerLeave = React.useCallback(() => {
        if (context?.slug != null) {
            window.dispatchEvent(
                new CustomEvent(`property-hover-off:${context.slug}:${context.isResponse ? "response" : "request"}`, {
                    detail: context.jsonPropertyPath
                })
            );
        }
    }, [context]);

    if (context != null) {
        const href = `${slugToHref(context.slug)}${context.anchorIdParts.length > 0 ? `#${context.anchorIdParts.join(".")}` : ""}`;
        return (
            <FernAnchor href={href} sideOffset={sideOffset} asChild>
                <div
                    className="inline-flex items-center gap-2"
                    onPointerEnter={handlePointerEnter}
                    onPointerLeave={handlePointerLeave}
                >
                    {children}
                </div>
            </FernAnchor>
        );
    }

    return (
        <div
            className="inline-flex items-center gap-2"
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
        >
            {children}
        </div>
    );
}

export const SectionContainer = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
    ({ children, ...props }, ref) => {
        const context = useOptionalTypeDefinitionContext();
        const id =
            context != null
                ? `${slugToHref(context.slug)}${context.anchorIdParts.length > 0 ? `#${context.anchorIdParts.join(".")}` : ""}`
                : undefined;
        return (
            <div id={id} ref={ref} {...props} className={cn("relative", props.className)}>
                {children}
            </div>
        );
    }
);

SectionContainer.displayName = "SectionContainer";

export function PropertyContainer({
    children,
    ...props
}: {
    children: React.ReactNode;
} & React.ComponentProps<"div">) {
    const { collapsible, anchorIdParts } = useTypeDefinitionContext();
    const isActive = useIsActive();
    const ref = React.useRef<HTMLDivElement>(null);

    const isActiveWithBackwardCompat = React.useMemo(() => {
        if (isActive) {
            return true;
        }

        if (typeof window === "undefined" || anchorIdParts.length === 0) {
            return false;
        }

        const currentAnchor = window.location.hash.slice(1);
        if (!currentAnchor) {
            return false;
        }

        const lastPart = anchorIdParts[anchorIdParts.length - 1];
        return currentAnchor === lastPart;
    }, [isActive, anchorIdParts]);

    React.useEffect(() => {
        if (isActiveWithBackwardCompat) {
            isomorphicRequestIdleCallback(() => {
                ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 150);
        }
    }, [isActiveWithBackwardCompat]);
    return (
        <SectionContainer
            ref={ref}
            {...props}
            className={cn("m-3 space-y-3", { "mx-0": !collapsible }, props.className, {
                "before:bg-(color:--accent-a3) before:rounded-1 before:absolute before:-inset-2 before:z-[-1] before:content-['']":
                    isActiveWithBackwardCompat
            })}
        >
            {children}
        </SectionContainer>
    );
}

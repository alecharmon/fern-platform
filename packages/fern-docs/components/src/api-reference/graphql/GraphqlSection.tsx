"use client";

import type React from "react";
import { cn } from "../../cn";
import { useErrorBoundary } from "../../providers/ErrorBoundaryProvider";
import { Separator } from "../../Separator";
import { SectionContainer, TypeDefinitionAnchor } from "../endpoints/TypeDefinitionAnchor";

export function GraphqlSection({
    title,
    titleOverride,
    description,
    children,
    hideSeparator
}: {
    title: React.ReactNode;
    titleOverride?: string;
    description?: React.ReactNode;
    children: React.ReactNode;
    hideSeparator?: boolean;
}) {
    const ErrorBoundary = useErrorBoundary();
    return (
        <ErrorBoundary>
            <SectionContainer className="space-y-3 flex flex-col">
                <TypeDefinitionAnchor>
                    {titleOverride ? (
                        <div className="mb-0 mt-0 inline-flex items-center gap-2">
                            <h3 className="mb-0 mt-0">{titleOverride}</h3>
                            <div className={cn("text-sm", "text-(color:--grayscale-a11)")}>{title}</div>
                        </div>
                    ) : (
                        <h3 className="mt-0">{title}</h3>
                    )}
                </TypeDefinitionAnchor>
                {description}
                {hideSeparator ? null : <Separator />}
                {children}
            </SectionContainer>
        </ErrorBoundary>
    );
}

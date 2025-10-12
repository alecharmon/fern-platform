import { cn } from "@fern-docs/components/cn";
import { Separator } from "@fern-docs/components/Separator";
import type React from "react";

import { ErrorBoundary } from "@/components/error-boundary";

import { SectionContainer, TypeDefinitionAnchor } from "../endpoints/TypeDefinitionAnchor";

export function GrpcSection({
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
    return (
        <ErrorBoundary>
            <SectionContainer className="space-y-3">
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

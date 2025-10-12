import { Separator } from "@fern-docs/components/Separator";
import type React from "react";

import { ErrorBoundary } from "@/docs/components/error-boundary";

import { SectionContainer, TypeDefinitionAnchor } from "./TypeDefinitionAnchor";

export function EndpointSection({
    title,
    description,
    children,
    hideSeparator
}: {
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
    hideSeparator?: boolean;
}) {
    return (
        <ErrorBoundary>
            <SectionContainer className="space-y-3">
                <TypeDefinitionAnchor>
                    <h3 className="mt-0">{title}</h3>
                </TypeDefinitionAnchor>
                {description}
                {hideSeparator ? null : <Separator />}
                {children}
            </SectionContainer>
        </ErrorBoundary>
    );
}

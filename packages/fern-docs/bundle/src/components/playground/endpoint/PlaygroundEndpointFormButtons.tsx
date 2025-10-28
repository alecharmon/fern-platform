import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { FernButton, FernButtonGroup } from "@fern-docs/components/FernButton";
import { FernLink } from "@fern-docs/components/FernLink";
import { ArrowUpRight } from "lucide-react";

import { I18N } from "@/constants";

interface PlaygroundEndpointFormButtonsProps {
    node: FernNavigation.EndpointNode;
    resetWithExample: () => void;
    resetWithoutExample: () => void;
}

export function PlaygroundEndpointFormButtons({
    node,
    resetWithExample,
    resetWithoutExample
}: PlaygroundEndpointFormButtonsProps) {
    const apiReferenceId = FernNavigation.utils.getApiReferenceId(node);
    return (
        <div className="flex items-center justify-between">
            <FernButtonGroup>
                <FernButton onClick={resetWithExample} size="small" variant="minimal">
                    {I18N.buttons.useExample}
                </FernButton>
                <FernButton onClick={resetWithoutExample} size="small" variant="minimal">
                    {I18N.buttons.clearForm}
                </FernButton>
            </FernButtonGroup>

            <FernLink
                href={`/${node.slug}`}
                shallow={apiReferenceId === node.apiDefinitionId}
                className="text-(color:--grayscale-a11) hover:text-(color:--accent) inline-flex items-center gap-1 text-sm font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
                scroll={true}
            >
                <span>{I18N.apiReference.apiReference}</span>
                <ArrowUpRight className="size-icon" />
            </FernLink>
        </div>
    );
}

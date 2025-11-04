import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { FernButton, FernButtonGroup } from "@fern-docs/components/FernButton";
import { FernLink } from "@fern-docs/components/FernLink";
import { t } from "@fern-docs/i18n";
import { ArrowUpRight } from "lucide-react";

interface PlaygroundEndpointFormButtonsProps {
    node: FernNavigation.EndpointNode;
    resetWithExample: () => void;
    resetWithoutExample: () => void;
    lang: string;
}

export function PlaygroundEndpointFormButtons({
    node,
    resetWithExample,
    resetWithoutExample,
    lang
}: PlaygroundEndpointFormButtonsProps) {
    const apiReferenceId = FernNavigation.utils.getApiReferenceId(node);
    return (
        <div className="flex items-center justify-between">
            <FernButtonGroup>
                <FernButton onClick={resetWithExample} size="small" variant="minimal">
                    {t(lang).buttons.useExample}
                </FernButton>
                <FernButton onClick={resetWithoutExample} size="small" variant="minimal">
                    {t(lang).buttons.clearForm}
                </FernButton>
            </FernButtonGroup>

            <FernLink
                href={`/${node.slug}`}
                shallow={apiReferenceId === node.apiDefinitionId}
                className="text-(color:--grayscale-a11) hover:text-(color:--accent) inline-flex items-center gap-1 text-sm font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
                scroll={true}
            >
                <span>{t(lang).apiReference.apiReference}</span>
                <ArrowUpRight className="size-icon" />
            </FernLink>
        </div>
    );
}

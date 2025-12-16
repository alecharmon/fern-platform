import type { ExampleEndpointCall } from "@fern-api/fdr-sdk/api-definition";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { ExampleSelector } from "@fern-docs/components/ExampleSelector";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernLink } from "@fern-docs/components/FernLink";
import { t } from "@fern-docs/i18n";
import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";

interface PlaygroundEndpointFormButtonsProps {
    node: FernNavigation.EndpointNode;
    examples: ExampleEndpointCall[] | undefined;
    selectedExampleIndex: number | undefined;
    onSelectExample: (exampleIndex: number) => void;
    resetWithoutExample: () => void;
    lang: string;
}

export function PlaygroundEndpointFormButtons({
    node,
    examples,
    selectedExampleIndex,
    onSelectExample,
    resetWithoutExample,
    lang
}: PlaygroundEndpointFormButtonsProps) {
    const apiReferenceId = FernNavigation.utils.getApiReferenceId(node);

    const exampleOptions = useMemo(() => {
        if (!examples || examples.length === 0) {
            return [];
        }
        return examples.map((example, index) => ({
            key: String(index),
            label: example.name ?? `Example ${index + 1}`,
            title: example.name ?? `Example ${index + 1}`
        }));
    }, [examples]);

    const hasExamples = exampleOptions.length > 0;

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {hasExamples && (
                    <ExampleSelector
                        options={exampleOptions}
                        selectedKey={selectedExampleIndex !== undefined ? String(selectedExampleIndex) : undefined}
                        onSelect={(key) => {
                            onSelectExample(parseInt(key, 10));
                        }}
                        lang={lang}
                        placeholder={t(lang).playground.selectExample}
                    />
                )}
                <FernButton onClick={resetWithoutExample} size="small" variant="minimal">
                    {t(lang).buttons.clearForm}
                </FernButton>
            </div>

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

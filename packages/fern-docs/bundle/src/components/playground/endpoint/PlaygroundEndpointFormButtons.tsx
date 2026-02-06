import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { CodeExample } from "@fern-docs/components/api-reference/examples/code-example";
import { ExampleSelector } from "@fern-docs/components/ExampleSelector";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernLink } from "@fern-docs/components/FernLink";
import { t } from "@fern-docs/i18n";
import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";

interface PlaygroundEndpointFormButtonsProps {
    node: FernNavigation.EndpointNode;
    segmentedControlExamples: { exampleKey: string; examples: CodeExample[] }[];
    selectedExampleIndex: number | undefined;
    onSelectExample: (exampleIndex: number) => void;
    resetWithoutExample: () => void;
    lang: string;
}

export function PlaygroundEndpointFormButtons({
    node,
    segmentedControlExamples,
    selectedExampleIndex,
    onSelectExample,
    resetWithoutExample,
    lang
}: PlaygroundEndpointFormButtonsProps) {
    const apiReferenceId = FernNavigation.utils.getApiReferenceId(node);

    const exampleOptions = useMemo(() => {
        if (!segmentedControlExamples || segmentedControlExamples.length === 0) {
            return [];
        }
        return segmentedControlExamples.map(({ exampleKey, examples }, index) => {
            // Use exampleCall.name (the actual example name) instead of snippet.name (the language name)
            const label = examples[0]?.exampleCall.name ?? exampleKey;
            return {
                key: String(index),
                label,
                title: label
            };
        });
    }, [segmentedControlExamples]);

    const hasExamples = exampleOptions.length > 0;

    return (
        <div className="fern-explorer-form-buttons flex items-center justify-between">
            <div className="flex items-center gap-2">
                {hasExamples && (
                    <ExampleSelector
                        className="fern-explorer-example-selector"
                        options={exampleOptions}
                        selectedKey={selectedExampleIndex !== undefined ? String(selectedExampleIndex) : undefined}
                        onSelect={(key) => {
                            onSelectExample(parseInt(key, 10));
                        }}
                        lang={lang}
                        placeholder={t(lang).playground.selectExample}
                        forceDropdown={true}
                    />
                )}
                <FernButton
                    className="fern-explorer-clear-form-button"
                    onClick={resetWithoutExample}
                    size="small"
                    variant="minimal"
                >
                    {t(lang).buttons.clearForm}
                </FernButton>
            </div>

            <FernLink
                href={`/${node.slug}`}
                shallow={apiReferenceId === node.apiDefinitionId}
                className="fern-explorer-api-reference-link text-(color:--grayscale-a11) hover:text-(color:--accent) inline-flex items-center gap-1 text-sm font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
                scroll={true}
            >
                <span>{t(lang).apiReference.apiReference}</span>
                <ArrowUpRight className="size-icon" />
            </FernLink>
        </div>
    );
}

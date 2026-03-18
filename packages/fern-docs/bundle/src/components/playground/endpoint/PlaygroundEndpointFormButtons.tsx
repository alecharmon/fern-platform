import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { CodeExample } from "@fern-docs/components/api-reference/examples/code-example";
import { ExampleSelector } from "@fern-docs/components/ExampleSelector";
import { FernButton } from "@fern-docs/components/FernButton";
import { t } from "@fern-docs/i18n";
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
        </div>
    );
}

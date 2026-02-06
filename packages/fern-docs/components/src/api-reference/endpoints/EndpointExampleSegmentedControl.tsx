import { type ReactElement, useMemo } from "react";
import { ExampleSelector } from "../../ExampleSelector";

import type { CodeExample } from "../examples/code-example";

export function EndpointExampleSegmentedControl({
    segmentedControlExamples,
    selectedExample,
    onSelectExample,
    lang
}: {
    segmentedControlExamples: {
        exampleKey: string;
        examples: CodeExample[];
    }[];
    selectedExample: CodeExample | undefined;
    onSelectExample: (exampleKey: string) => void;
    lang: string;
}): ReactElement<any> {
    const options = useMemo(() => {
        return segmentedControlExamples.map(({ exampleKey, examples }) => {
            // Use exampleCall.name (the actual example name) instead of snippet.name (the language name)
            const label = examples[0]?.exampleCall.name ?? exampleKey;
            return {
                key: exampleKey,
                label,
                title: label
            };
        });
    }, [segmentedControlExamples]);

    const totalLabelLengthForDropdownCheck = useMemo(() => {
        return segmentedControlExamples
            .flatMap(({ examples }) => examples)
            .filter((ex) => ex.exampleCall.responseStatusCode < 400)
            .map((ex) => ex.exampleCall.name)
            .join("").length;
    }, [segmentedControlExamples]);

    return (
        <ExampleSelector
            options={options}
            selectedKey={selectedExample?.exampleKey}
            onSelect={onSelectExample}
            lang={lang}
            totalLabelLengthOverride={totalLabelLengthForDropdownCheck}
        />
    );
}

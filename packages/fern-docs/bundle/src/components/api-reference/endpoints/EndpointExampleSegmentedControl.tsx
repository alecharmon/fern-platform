import { ReactElement } from "react";

import { ChevronDown } from "lucide-react";

import { FernButton, FernButtonGroup } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";

import { CodeExample } from "../examples/code-example";

export function EndpointExampleSegmentedControl({
    segmentedControlExamples,
    selectedExample,
    onSelectExample
}: {
    segmentedControlExamples: {
        exampleKey: string;
        examples: CodeExample[];
    }[];
    selectedExample: CodeExample | undefined;
    onSelectExample: (exampleKey: string) => void;
}): ReactElement<any> {
    if (
        segmentedControlExamples.length >= 8 ||
        segmentedControlExamples
            .flatMap(({ examples }) => examples)
            .filter((ex) => ex.exampleCall.responseStatusCode < 400)
            .map(({ name }) => name)
            .join("").length >= 80
    ) {
        return (
            <div className="w-full min-w-0">
                <FernDropdown
                    options={segmentedControlExamples.map(({ exampleKey, examples }) => ({
                        type: "value",
                        value: exampleKey,
                        label: examples[0]?.name ?? exampleKey,
                        labelClassName: "truncate max-w-md"
                    }))}
                    onValueChange={(value) => {
                        onSelectExample(value);
                    }}
                    value={selectedExample?.exampleKey}
                >
                    <FernButton
                        className="w-full min-w-0 truncate text-left"
                        size="normal"
                        variant="outlined"
                        text={selectedExample?.name ?? selectedExample?.exampleKey}
                        rightIcon={<ChevronDown className="size-icon flex-shrink-0" />}
                    />
                </FernDropdown>
            </div>
        );
    }

    // TODO: Replace this with a proper segmented control component
    return (
        <div className="w-full min-w-0">
            <FernButtonGroup className="w-full min-w-0">
                {segmentedControlExamples.map(({ exampleKey, examples }) => {
                    const exampleIndex = examples[0]?.exampleIndex ?? 0;
                    return (
                        <FernButton
                            key={exampleKey}
                            rounded={true}
                            onClick={() => {
                                onSelectExample(exampleKey);
                            }}
                            className={
                                "min-w-0 flex-1 truncate" +
                                (exampleKey === selectedExample?.exampleKey ? " ring-primary-500" : " ring-transparent")
                            }
                            mono
                            size="small"
                            variant="outlined"
                            intent={exampleKey === selectedExample?.exampleKey ? "primary" : "none"}
                        >
                            <span
                                className="block w-full truncate"
                                title={
                                    (exampleKey === selectedExample?.exampleKey ? selectedExample?.name : undefined) ??
                                    examples[0]?.name ??
                                    examples[0]?.exampleCall.name ??
                                    `Example ${exampleIndex + 1}`
                                }
                            >
                                {(exampleKey === selectedExample?.exampleKey ? selectedExample?.name : undefined) ??
                                    examples[0]?.name ??
                                    examples[0]?.exampleCall.name ??
                                    `Example ${exampleIndex + 1}`}
                            </span>
                        </FernButton>
                    );
                })}
            </FernButtonGroup>
        </div>
    );
}

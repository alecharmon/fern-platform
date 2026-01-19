"use client";

import type { APIV1Read } from "@fern-api/fdr-sdk";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { ExampleSelector } from "../../ExampleSelector";
import { WebhookExample } from "./WebhookExample";

export interface WebhookExamplesClientProps {
    examples: APIV1Read.ExampleWebhookPayload[];
    slug: string;
    lang: string;
}

export function WebhookExamplesClient({ examples, slug, lang }: WebhookExamplesClientProps): ReactElement<any> | null {
    const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);

    const selectedExample = useMemo(() => {
        return examples[selectedExampleIndex];
    }, [examples, selectedExampleIndex]);

    const selectorOptions = useMemo(() => {
        return examples.map((_, index) => {
            const label = `Example ${index + 1}`;
            return {
                key: String(index),
                label,
                title: label
            };
        });
    }, [examples]);

    if (examples.length === 0 || selectedExample == null) {
        return null;
    }

    return (
        <div className="not-prose flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            {examples.length > 1 && (
                <ExampleSelector
                    options={selectorOptions}
                    selectedKey={String(selectedExampleIndex)}
                    onSelect={(key) => setSelectedExampleIndex(Number(key))}
                    lang={lang}
                />
            )}
            <WebhookExample example={selectedExample} slug={slug} lang={lang} />
        </div>
    );
}

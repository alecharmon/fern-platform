import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { CodeSnippetExample } from "@fern-docs/components/api-reference/examples/CodeSnippetExample";
import { cn } from "@fern-docs/components/cn";
import { useMemo } from "react";

import { generateExampleFromTypeDefinition } from "./generate-example-from-type";

type SchemaSnippetProps = {
    /**
     * @internal the rehype plugin will set this
     */
    typeDefinition?: ApiDefinition.TypeDefinition;
    /**
     * @internal the rehype plugin will set this
     */
    types?: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    /**
     * Language for localization
     */
    lang?: string;
    /**
     * Optional title for the snippet. Defaults to "Example"
     */
    title?: string;
    className?: string;
    /**
     * Line numbers to highlight. Supports range syntax like `highlight={[1-5, 7, 9]}`.
     */
    highlight?: number | number[];
};

export function SchemaSnippet({ typeDefinition, types, lang, title, className, highlight }: SchemaSnippetProps) {
    const language = lang ?? "en";

    const example = useMemo(() => {
        if (typeDefinition == null || types == null) {
            return null;
        }
        return generateExampleFromTypeDefinition(typeDefinition, types);
    }, [typeDefinition, types]);

    if (typeDefinition == null || types == null || example == null) {
        return null;
    }

    const exampleJson = JSON.stringify(example, null, 2);

    return (
        <div className={cn("mb-5 mt-3", className)}>
            <CodeSnippetExample
                title={title ?? "Example"}
                code={exampleJson}
                language="json"
                json={example}
                scrollAreaStyle={{ maxHeight: "500px" }}
                lang={language}
                highlight={highlight}
            />
        </div>
    );
}

"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { t } from "@fern-docs/i18n";
import { memo } from "react";
import { cn } from "../../cn";
import { CodeSnippetExample, JsonCodeSnippetExample } from "../examples/CodeSnippetExample";
import { useGraphqlContext } from "./GraphqlContext";

export declare namespace GraphqlContentCodeSnippets {
    export interface Props {
        node: FernNavigation.GraphQlNode;
        className?: string;
        lang: string;
    }
}

const UnmemoizedGraphqlContentCodeSnippets: React.FC<GraphqlContentCodeSnippets.Props> = ({
    node,
    className,
    lang
}) => {
    const { example } = useGraphqlContext();

    return (
        <div
            className={cn(
                "not-prose",
                "fern-endpoint-code-snippets w-full",
                "grid grid-rows-[repeat(auto-fit,minmax(0,min-content))] gap-6",
                className
            )}
        >
            <CodeSnippetExample
                title="Example Query"
                onClick={(e) => {
                    e.stopPropagation();
                }}
                code={example?.query ?? ""}
                language="graphql"
                json={example?.query}
                slug={node?.slug ?? ""}
                isResponse={false}
                lang={lang}
            />

            {example?.variables && Object.keys(example.variables).length > 0 && (
                <JsonCodeSnippetExample
                    title="Variables"
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                    json={example.variables}
                    slug={node?.slug ?? ""}
                    isResponse={false}
                    lang={lang}
                />
            )}

            <JsonCodeSnippetExample
                title={t(lang).apiReference.exampleResponse}
                onClick={(e) => {
                    e.stopPropagation();
                }}
                json={example?.response}
                slug={node?.slug ?? ""}
                isResponse={true}
                lang={lang}
            />
        </div>
    );
};

export const GraphqlContentCodeSnippets = memo(UnmemoizedGraphqlContentCodeSnippets);

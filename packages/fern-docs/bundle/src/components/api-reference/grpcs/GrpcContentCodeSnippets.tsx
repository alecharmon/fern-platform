"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { cn } from "@fern-docs/components/cn";
import { memo } from "react";

import { JsonCodeSnippetExample } from "../examples/CodeSnippetExample";
import { useGrpcContext } from "./GrpcContext";

export declare namespace GrpcContentCodeSnippets {
    export interface Props {
        node: FernNavigation.GrpcNode;
        className?: string;
    }
}

const UnmemoizedGrpcContentCodeSnippets: React.FC<GrpcContentCodeSnippets.Props> = ({ node, className }) => {
    const { example } = useGrpcContext();

    return (
        <div
            className={cn(
                "not-prose",
                // note: .fern-endpoint-code-snippets class is used to detect clicks outside of the code snippets
                // this is used to clear the selected error when the user clicks outside of the error
                "fern-endpoint-code-snippets w-full",
                // this is used to ensure that two long code snippets will take up the same height,
                // but if one is shorter the other snippet will take up the remaining space
                "grid grid-rows-[repeat(auto-fit,minmax(0,min-content))] gap-6",
                className
            )}
        >
            <JsonCodeSnippetExample
                title={"Example Request"}
                onClick={(e) => {
                    e.stopPropagation();
                }}
                json={example?.request}
                slug={node?.slug ?? ""}
                isResponse={false}
            />

            <JsonCodeSnippetExample
                title={"Example Response"}
                onClick={(e) => {
                    e.stopPropagation();
                }}
                json={example?.response}
                slug={node?.slug ?? ""}
                isResponse={true}
            />
        </div>
    );
};

export const GrpcContentCodeSnippets = memo(UnmemoizedGrpcContentCodeSnippets);

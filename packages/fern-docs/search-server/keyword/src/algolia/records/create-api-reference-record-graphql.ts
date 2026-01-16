import type { ApiDefinition } from "@fern-api/fdr-sdk";
import { measureBytes, truncateToBytes } from "@fern-api/ui-core-utils";
import { maybePrepareMdxContent, toDescription } from "@fern-docs/search-utils";

import type { ApiReferenceRecord, EndpointBaseRecord } from "../types";

interface CreateApiReferenceRecordGraphQlOptions {
    graphqlBase: EndpointBaseRecord;
    graphqlOperation: ApiDefinition.GraphQlOperation;
}

export function createApiReferenceRecordGraphQl({
    graphqlBase,
    graphqlOperation
}: CreateApiReferenceRecordGraphQlOptions): ApiReferenceRecord[] {
    const base: ApiReferenceRecord = {
        ...graphqlBase,
        type: "api-reference"
    };

    const records: ApiReferenceRecord[] = [base];

    // Add arguments section if there are arguments with descriptions
    if (graphqlOperation.arguments && graphqlOperation.arguments.length > 0) {
        const argsWithDescriptions = graphqlOperation.arguments.filter((arg) => arg.description != null);
        if (argsWithDescriptions.length > 0) {
            const { content: args_description, code_snippets: args_description_code_snippets } = maybePrepareMdxContent(
                argsWithDescriptions.map((arg) => `**${arg.name}**: ${toDescription(arg.description)}`).join("\n\n")
            );

            if (args_description != null || args_description_code_snippets?.length) {
                records.push({
                    ...base,
                    objectID: `${base.objectID}-arguments`,
                    hash: "#arguments",
                    breadcrumb: [...(base.breadcrumb ?? []), { title: base.title, pathname: base.pathname }],
                    title: `${base.title} - Arguments`,
                    description: args_description != null ? truncateToBytes(args_description, 50 * 1000) : undefined,
                    code_snippets: args_description_code_snippets?.filter(
                        (codeSnippet) => measureBytes(codeSnippet.code) < 2000
                    ),
                    page_position: 1
                });
            }
        }
    }

    return records;
}

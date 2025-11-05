import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { EndpointDefinition } from "@fern-api/fdr-sdk/api-definition";
import { cn } from "@fern-docs/components/cn";
import { t } from "@fern-docs/i18n";
import { useExampleSelection } from "@/components/api-reference/endpoints/useExampleSelection";
import { CodeSnippetExample } from "@/components/api-reference/examples/CodeSnippetExample";

export function EndpointResponseSnippet({
    example,
    endpointDefinition,
    slug,
    className,
    lang
}: {
    /**
     * The endpoint locator to use for the request snippet.
     */
    endpoint?: string;
    /**
     * The example to use for the request snippet.
     */
    example?: string | undefined;
    /**
     * @internal the rehype-endpoint-examples-snippets plugin will set this
     */
    endpointDefinition?: ApiDefinition.EndpointDefinition;
    /**
     * The slug of the endpoint.
     */
    slug: string;
    className?: string;
    lang?: string;
}) {
    if (endpointDefinition == null) {
        return null;
    }

    return (
        <EndpointResponseSnippetInternal
            endpoint={endpointDefinition}
            example={example}
            slug={slug}
            className={className}
            lang={lang ?? "en"}
        />
    );
}

function EndpointResponseSnippetInternal({
    endpoint,
    example,
    slug,
    className,
    lang
}: {
    slug: string;
    endpoint: EndpointDefinition;
    example: string | undefined;
    className?: string;
    lang: string;
}) {
    const { selectedExample } = useExampleSelection(endpoint, example);

    const responseJson = selectedExample?.exampleCall.responseBody?.value;

    if (responseJson == null) {
        return null;
    }

    const responseJsonString = JSON.stringify(responseJson, null, 2);

    return (
        <div className={cn("mb-5 mt-3", className)}>
            <CodeSnippetExample
                title={t(lang).apiReference.response}
                // actions={undefined}
                code={responseJsonString}
                language="json"
                json={responseJson}
                scrollAreaStyle={{ maxHeight: "500px" }}
                slug={slug}
                isResponse
                lang={lang}
            />
        </div>
    );
}

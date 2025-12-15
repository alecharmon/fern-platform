import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { EMPTY_OBJECT } from "@fern-api/ui-core-utils";
import { CodeExampleClientDropdown } from "@fern-docs/components/api-reference/endpoints/CodeExampleClientDropdown";
import { EndpointUrlWithOverflow } from "@fern-docs/components/api-reference/endpoints/EndpointUrlWithOverflow";
import { useExampleSelection } from "@fern-docs/components/api-reference/endpoints/useExampleSelection";
import { CodeSnippetExample } from "@fern-docs/components/api-reference/examples/CodeSnippetExample";
import { cn } from "@fern-docs/components/cn";
import { useCurrentVersionSlug } from "@fern-docs/components/state/navigation";
import type { ReactElement } from "react";
import { ApiReferenceButton } from "@/components/ApiReferenceButton";
import { usePlaygroundBaseUrl } from "@/components/playground/utils/select-environment";

export function EndpointRequestSnippet({
    example,
    endpointDefinition,
    slugs,
    lang,
    className
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
     * @internal the rehype-endpoint--examples-snippets plugin will set this
     */
    endpointDefinition?: ApiDefinition.EndpointDefinition;
    /**
     * @internal the rehype-endpoint-examples-snippets plugin will set this
     */
    slugs?: string[];
    lang?: string;
    className?: string;
}) {
    if (endpointDefinition == null) {
        return null;
    }

    return (
        <EndpointRequestSnippetInternal
            endpoint={endpointDefinition}
            slugs={slugs ?? []}
            example={example}
            className={className}
            lang={lang ?? "en"}
        />
    );
}

function EndpointRequestSnippetInternal({
    endpoint,
    example,
    slugs,
    className,
    lang
}: {
    endpoint: ApiDefinition.EndpointDefinition;
    example: string | undefined;
    slugs: string[];
    lang: string;
    className?: string;
}): ReactElement<any> | null {
    const slug = useCurrentSlug(slugs);
    const { selectedExample, selectedExampleKey, availableLanguages, setSelectedExampleKey } = useExampleSelection(
        endpoint,
        example
    );

    const [baseUrl, selectedEnvironmentId] = usePlaygroundBaseUrl(endpoint);

    if (selectedExample == null) {
        return null;
    }

    return (
        <div className={cn("mb-5 mt-3", className)}>
            <CodeSnippetExample
                title={
                    <EndpointUrlWithOverflow
                        path={endpoint.path}
                        method={endpoint.method}
                        environmentId={selectedEnvironmentId}
                        baseUrl={baseUrl}
                        options={endpoint.environments}
                        hideCopyButton={true}
                        lang={lang}
                    />
                }
                lang={lang}
                // include both dropdown and api ref button for proper placement
                languageDropdown={
                    <>
                        {availableLanguages.length > 1 && (
                            <CodeExampleClientDropdown
                                languages={availableLanguages}
                                onValueChange={(language) =>
                                    setSelectedExampleKey((prev) => ({
                                        ...prev,
                                        language
                                    }))
                                }
                                value={selectedExampleKey.language}
                                lang={lang}
                            />
                        )}
                        {slug != null && <ApiReferenceButton slug={slug} lang={lang} />}
                    </>
                }
                code={selectedExample.code}
                language={selectedExampleKey.language}
                json={EMPTY_OBJECT}
                scrollAreaStyle={{ maxHeight: "500px" }}
            />
        </div>
    );
}

function useCurrentSlug(slugs: string[]): string | undefined {
    const currentVersionSlug = useCurrentVersionSlug();

    if (slugs.length === 0) {
        return undefined;
    }

    if (slugs.length === 1 && slugs[0]) {
        return slugs[0];
    }

    if (currentVersionSlug == null) {
        return slugs[0];
    }

    const slug = slugs.find((slug) => slug.startsWith(currentVersionSlug + "/"));
    return slug ?? slugs[0];
}

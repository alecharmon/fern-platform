import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { FernButton, FernButtonGroup } from "@fern-docs/components/FernButton";
import { FernCard } from "@fern-docs/components/FernCard";
import { jotaiStore } from "@fern-docs/components/state/jotai-provider";
import { useSetAtom } from "jotai";
import { type ReactElement, useRef } from "react";

import { CodeExampleClientDropdown } from "@/components/api-reference/endpoints/CodeExampleClientDropdown";
import { useProgrammingLanguage } from "@/state/language";
import { PLAYGROUND_AUTH_STATE_ATOM, PLAYGROUND_AUTH_STATE_OAUTH_ATOM } from "@/state/playground";
import { PlaygroundCodeSnippetResolverBuilder } from "../code-snippets/resolver";
import { PlaygroundRequestPreview } from "../PlaygroundRequestPreview";
import type { PlaygroundEndpointRequestFormState } from "../types";
import { usePlaygroundBaseUrl } from "../utils/select-environment";
import {
    type DynamicSnippetLanguage,
    PlaygroundDynamicRequestPreview,
    type PlaygroundDynamicRequestPreviewRef
} from "./PlaygroundDynamicRequestPreview";

interface PlaygroundEndpointRequestCardProps {
    context: EndpointContext;
    formState: PlaygroundEndpointRequestFormState;
    dynamicIRsByLanguage: DynamicIRsByLanguage | undefined;
}

type RequestType = "curl" | DynamicSnippetLanguage;

function useRequestType(
    dynamicIRsByLanguage: DynamicIRsByLanguage | undefined
): [RequestType, (requestType: RequestType) => void] {
    const [lang, setLang] = useProgrammingLanguage();

    // get available languages (fallback + dynamic)
    const availableLanguages = new Set<RequestType>(["curl", "typescript", "python"]);
    if (dynamicIRsByLanguage) {
        Object.keys(dynamicIRsByLanguage).forEach((lang) => availableLanguages.add(lang as DynamicSnippetLanguage));
    }

    // if user has selected a dynamic language that's available, use it
    let currentRequestType: RequestType;
    if (dynamicIRsByLanguage?.[lang as DynamicSnippetLanguage]) {
        currentRequestType = lang as DynamicSnippetLanguage;
    }
    // otherwise, map to fallback languages
    else if (lang === "typescript" || lang === "javascript") {
        currentRequestType = "typescript";
    } else if (lang === "python") {
        currentRequestType = "python";
    } else {
        currentRequestType = "curl";
    }

    // ensure current type is available, fallback to curl if not
    if (!availableLanguages.has(currentRequestType)) {
        currentRequestType = "curl";
    }

    return [currentRequestType, setLang];
}

export function PlaygroundEndpointRequestCard({
    context,
    formState,
    dynamicIRsByLanguage
}: PlaygroundEndpointRequestCardProps): ReactElement<any> | null {
    const [requestType, setRequestType] = useRequestType(dynamicIRsByLanguage);
    const setOAuthValue = useSetAtom(PLAYGROUND_AUTH_STATE_OAUTH_ATOM);
    const [baseUrl] = usePlaygroundBaseUrl(context.endpoint, context.node.apiDefinitionId);
    const dynamicPreviewRef = useRef<PlaygroundDynamicRequestPreviewRef>(null);

    const hasDynamicIr = Object.keys(dynamicIRsByLanguage ?? {}).length > 0;
    const isHeadRequest = context.endpoint.method === "HEAD";
    const shouldUseDynamicSnippets = dynamicIRsByLanguage?.[requestType as DynamicSnippetLanguage] && !isHeadRequest;

    const getFallbackRequestType = (): "curl" | "typescript" | "python" => {
        if (requestType === "typescript") return "typescript";
        if (requestType === "python") return "python";
        return "curl";
    };

    return (
        <FernCard className="rounded-3 flex min-w-0 flex-1 shrink flex-col overflow-hidden">
            <div className="border-border-default flex h-10 w-full shrink-0 items-center justify-between border-b px-3 py-2">
                <span className="text-(color:--grayscale-a11) text-xs uppercase">Request</span>
                {!hasDynamicIr && (
                    <FernButtonGroup>
                        <FernButton
                            onClick={() => setRequestType("curl")}
                            size="small"
                            variant="minimal"
                            intent={requestType === "curl" ? "primary" : "none"}
                            active={requestType === "curl"}
                        >
                            cURL
                        </FernButton>
                        <FernButton
                            onClick={() => setRequestType("typescript")}
                            size="small"
                            variant="minimal"
                            intent={requestType === "typescript" ? "primary" : "none"}
                            active={requestType === "typescript"}
                        >
                            TypeScript
                        </FernButton>
                        <FernButton
                            onClick={() => setRequestType("python")}
                            size="small"
                            variant="minimal"
                            intent={requestType === "python" ? "primary" : "none"}
                            active={requestType === "python"}
                        >
                            Python
                        </FernButton>
                    </FernButtonGroup>
                )}
                <div className="flex items-center gap-2">
                    {hasDynamicIr && (
                        <CodeExampleClientDropdown
                            languages={["curl", ...Object.keys(dynamicIRsByLanguage ?? {})]}
                            value={requestType}
                            onValueChange={(language) => {
                                setRequestType(language as RequestType);
                            }}
                        />
                    )}
                    <CopyToClipboardButton
                        content={() => {
                            // if using dynamic snippets, get the code from the dynamic preview
                            if (shouldUseDynamicSnippets && dynamicPreviewRef.current) {
                                return dynamicPreviewRef.current.getCurrentCode();
                            }

                            // otherwise, use the fallback resolver
                            const authState = jotaiStore.get(PLAYGROUND_AUTH_STATE_ATOM);
                            const resolver = new PlaygroundCodeSnippetResolverBuilder(context, true).create(
                                authState,
                                formState,
                                baseUrl,
                                setOAuthValue
                            );
                            return resolver.resolve(getFallbackRequestType());
                        }}
                        className="-mr-2"
                    />
                </div>
            </div>
            {shouldUseDynamicSnippets ? (
                <PlaygroundDynamicRequestPreview
                    ref={dynamicPreviewRef}
                    context={context}
                    formState={formState}
                    requestType={requestType as DynamicSnippetLanguage}
                    dynamicIRsByLanguage={dynamicIRsByLanguage}
                />
            ) : (
                <PlaygroundRequestPreview
                    context={context}
                    formState={formState}
                    requestType={getFallbackRequestType()}
                />
            )}
        </FernCard>
    );
}

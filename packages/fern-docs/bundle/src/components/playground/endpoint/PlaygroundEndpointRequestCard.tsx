import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { CodeExampleClientDropdown } from "@fern-docs/components/api-reference/endpoints/CodeExampleClientDropdown";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { ExpandCodeButton } from "@fern-docs/components/ExpandCodeButton";
import { FernButton, FernButtonGroup } from "@fern-docs/components/FernButton";
import { FernCard } from "@fern-docs/components/FernCard";
import { useIsDarkCode } from "@fern-docs/components/state/dark-code";
import { useProgrammingLanguage } from "@fern-docs/components/state/language";
import { t } from "@fern-docs/i18n";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactElement, useMemo, useRef } from "react";
import {
    PLAYGROUND_AUTH_STATE_ATOM,
    PLAYGROUND_AUTH_STATE_OAUTH_ATOM,
    PLAYGROUND_SELECTED_AUTH_TYPE_ATOM
} from "@/state/playground";
import { PlaygroundCodeSnippetResolverBuilder } from "../code-snippets/resolver";
import { PlaygroundRequestPreview } from "../PlaygroundRequestPreview";
import type { PlaygroundAuthState, PlaygroundEndpointRequestFormState } from "../types";
import { getAuthKey } from "../utils";
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
    lang: string;
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
    dynamicIRsByLanguage,
    lang
}: PlaygroundEndpointRequestCardProps): ReactElement<any> | null {
    const [requestType, setRequestType] = useRequestType(dynamicIRsByLanguage);
    const isDarkCode = useIsDarkCode();
    const setOAuthValue = useSetAtom(PLAYGROUND_AUTH_STATE_OAUTH_ATOM);
    const [baseUrl] = usePlaygroundBaseUrl(context.endpoint, context.node.apiDefinitionId);
    const dynamicPreviewRef = useRef<PlaygroundDynamicRequestPreviewRef>(null);
    const selectedAuthType = useAtomValue(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    // Use a ref to always have access to the latest authState in the copy callback
    const authStateRef = useRef<PlaygroundAuthState>(authState);
    authStateRef.current = authState;

    const { selectedAuth, authKey, selectedAuthSchemes, selectedAuthKeys } = useMemo(() => {
        const authEntries =
            context.authOptionEntries.length > 0
                ? context.authOptionEntries
                : context.authsWithKeys.map((authWithKey) => ({
                      key: getAuthKey(authWithKey),
                      schemeIds: [authWithKey.key],
                      schemes: [authWithKey.scheme],
                      label: String(authWithKey.key)
                  }));

        if (authEntries.length === 0) {
            return {
                selectedAuth: undefined,
                authKey: undefined,
                selectedAuthSchemes: undefined,
                selectedAuthKeys: undefined
            };
        }

        let selectedEntry = authEntries[0];
        if (selectedAuthType) {
            const entry = authEntries.find((e) => e.key === selectedAuthType);
            if (entry) {
                selectedEntry = entry;
            }
        }

        return {
            selectedAuth: selectedEntry?.schemes[0],
            authKey: String(selectedEntry?.schemeIds[0]),
            selectedAuthSchemes: selectedEntry?.schemes,
            selectedAuthKeys: selectedEntry?.schemeIds.map((id) => String(id))
        };
    }, [context.authOptionEntries, context.authsWithKeys, selectedAuthType]);

    const hasDynamicIr = Object.keys(dynamicIRsByLanguage ?? {}).length > 0;
    const isHeadRequest = context.endpoint.method === "HEAD";
    const shouldUseDynamicSnippets = dynamicIRsByLanguage?.[requestType as DynamicSnippetLanguage] && !isHeadRequest;

    const getFallbackRequestType = (): "curl" | "typescript" | "python" => {
        if (requestType === "typescript") {
            return "typescript";
        }
        if (requestType === "python") {
            return "python";
        }
        return "curl";
    };

    return (
        <FernCard
            className={cn("fern-explorer-request-card rounded-3 flex min-w-0 flex-1 shrink flex-col overflow-hidden", {
                "bg-card-solid dark": isDarkCode
            })}
        >
            <div className="fern-explorer-request-header border-border-default flex h-10 w-full shrink-0 items-center justify-between border-b px-3 py-2">
                <span className="fern-explorer-request-title text-(color:--grayscale-a11) text-xs uppercase">
                    {t(lang).apiReference.request}
                </span>
                {!hasDynamicIr && (
                    <FernButtonGroup>
                        <FernButton
                            onClick={() => setRequestType("curl")}
                            size="small"
                            variant="minimal"
                            intent={requestType === "curl" ? "primary" : "none"}
                            active={requestType === "curl"}
                        >
                            {"cURL"}
                        </FernButton>
                        <FernButton
                            onClick={() => setRequestType("typescript")}
                            size="small"
                            variant="minimal"
                            intent={requestType === "typescript" ? "primary" : "none"}
                            active={requestType === "typescript"}
                        >
                            {"TypeScript"}
                        </FernButton>
                        <FernButton
                            onClick={() => setRequestType("python")}
                            size="small"
                            variant="minimal"
                            intent={requestType === "python" ? "primary" : "none"}
                            active={requestType === "python"}
                        >
                            {"Python"}
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
                            lang={lang}
                        />
                    )}
                    <ExpandCodeButton
                        content={() => {
                            if (shouldUseDynamicSnippets && dynamicPreviewRef.current) {
                                return dynamicPreviewRef.current.getCurrentCode();
                            }

                            const resolver = new PlaygroundCodeSnippetResolverBuilder(context, true).create(
                                authStateRef.current,
                                formState,
                                baseUrl,
                                setOAuthValue,
                                selectedAuth,
                                authKey,
                                selectedAuthSchemes,
                                selectedAuthKeys
                            );
                            return resolver.resolve(getFallbackRequestType());
                        }}
                        language={requestType === "curl" ? "bash" : requestType}
                        lang={lang}
                    />
                    <CopyToClipboardButton
                        content={() => {
                            // if using dynamic snippets, get the code from the dynamic preview
                            if (shouldUseDynamicSnippets && dynamicPreviewRef.current) {
                                return dynamicPreviewRef.current.getCurrentCode();
                            }

                            const resolver = new PlaygroundCodeSnippetResolverBuilder(context, true).create(
                                authStateRef.current,
                                formState,
                                baseUrl,
                                setOAuthValue,
                                selectedAuth,
                                authKey,
                                selectedAuthSchemes,
                                selectedAuthKeys
                            );
                            return resolver.resolve(getFallbackRequestType());
                        }}
                        className="-mr-2"
                        lang={lang}
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
                    lang={lang}
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

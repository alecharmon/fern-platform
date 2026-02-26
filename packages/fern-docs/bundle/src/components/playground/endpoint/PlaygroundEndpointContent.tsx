import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import type { CodeExample } from "@fern-docs/components/api-reference/examples/code-example";
import type { Loadable } from "@fern-ui/loadable";
import { useAtomValue, useSetAtom } from "jotai";
import { type Dispatch, type ReactElement, type SetStateAction, useCallback, useDeferredValue, useRef } from "react";

import {
    PLAYGROUND_AUTH_STATE_ATOM,
    PLAYGROUND_AUTH_STATE_OAUTH_ATOM,
    PLAYGROUND_SELECTED_AUTH_TYPE_ATOM
} from "@/state/playground";
import { PlaygroundCodeSnippetResolverBuilder } from "../code-snippets/resolver";
import type { PlaygroundAuthState, PlaygroundEndpointRequestFormState } from "../types";
import type { PlaygroundResponse } from "../types/playgroundResponse";
import { getAuthKey } from "../utils";
import { usePlaygroundBaseUrl } from "../utils/select-environment";
import { isLocal } from "../utils/utils";
import { PlaygroundEndpointContentLayout } from "./PlaygroundEndpointContentLayout";
import { PlaygroundEndpointForm } from "./PlaygroundEndpointForm";
import { PlaygroundEndpointFormButtons } from "./PlaygroundEndpointFormButtons";
import { PlaygroundEndpointRequestCard } from "./PlaygroundEndpointRequestCard";
import { PlaygroundResponseCard } from "./PlaygroundResponseCard";

interface PlaygroundEndpointContentProps {
    context: EndpointContext;
    formState: PlaygroundEndpointRequestFormState;
    setFormState: Dispatch<SetStateAction<PlaygroundEndpointRequestFormState>>;
    segmentedControlExamples: { exampleKey: string; examples: CodeExample[] }[];
    selectedExampleIndex: number | undefined;
    onSelectExample: (exampleIndex: number) => void;
    resetWithoutExample: () => void;
    response: Loadable<PlaygroundResponse>;
    sendRequest: () => void;
    authForm?: React.ReactNode;
    dynamicIRsByLanguage: DynamicIRsByLanguage | undefined;
    lang: string;
    mobileTab?: string;
    onMobileTabChange?: (value: string) => void;
}

export function PlaygroundEndpointContent({
    context,
    formState,
    setFormState,
    segmentedControlExamples,
    selectedExampleIndex,
    onSelectExample,
    resetWithoutExample,
    response,
    sendRequest,
    authForm,
    dynamicIRsByLanguage,
    lang,
    mobileTab,
    onMobileTabChange
}: PlaygroundEndpointContentProps): ReactElement<any> {
    const deferredFormState = useDeferredValue(formState);
    const [baseUrl] = usePlaygroundBaseUrl(context.endpoint, context.node.apiDefinitionId);
    const requestDisabled = !isLocal() && baseUrl?.includes("localhost");

    const setOAuthValue = useSetAtom(PLAYGROUND_AUTH_STATE_OAUTH_ATOM);
    const selectedAuthType = useAtomValue(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    const authStateRef = useRef<PlaygroundAuthState>(authState);
    authStateRef.current = authState;

    const getCurlCommand = useCallback((): string => {
        const authEntries =
            context.authOptionEntries.length > 0
                ? context.authOptionEntries
                : context.authsWithKeys.map((authWithKey) => ({
                      key: getAuthKey(authWithKey),
                      schemeIds: [authWithKey.key],
                      schemes: [authWithKey.scheme],
                      label: String(authWithKey.key)
                  }));

        let selectedEntry = authEntries[0];
        if (selectedAuthType) {
            const entry = authEntries.find((e) => e.key === selectedAuthType);
            if (entry) {
                selectedEntry = entry;
            }
        }

        const resolver = new PlaygroundCodeSnippetResolverBuilder(context, true).create(
            authStateRef.current,
            formState,
            baseUrl,
            setOAuthValue,
            selectedEntry?.schemes[0],
            selectedEntry ? String(selectedEntry.schemeIds[0]) : undefined,
            selectedEntry?.schemes,
            selectedEntry?.schemeIds.map((id) => String(id))
        );
        return resolver.resolve("curl");
    }, [context, formState, baseUrl, setOAuthValue, selectedAuthType]);

    const form = (
        <div className="fern-explorer-form mx-auto w-full max-w-5xl space-y-6 pt-6 max-sm:pt-0 sm:pb-20">
            <div key="auth-form" className="fern-explorer-auth-form">
                {authForm}
            </div>

            <div key="endpoint-form" className="fern-explorer-endpoint-form col-span-2 space-y-8">
                <PlaygroundEndpointForm
                    context={context}
                    formState={formState}
                    setFormState={setFormState}
                    lang={lang}
                />
            </div>

            <PlaygroundEndpointFormButtons
                key="form-buttons"
                node={context.node}
                segmentedControlExamples={segmentedControlExamples}
                selectedExampleIndex={selectedExampleIndex}
                onSelectExample={onSelectExample}
                resetWithoutExample={resetWithoutExample}
                lang={lang}
            />
        </div>
    );

    const requestCard = (
        <PlaygroundEndpointRequestCard
            context={context}
            formState={deferredFormState}
            dynamicIRsByLanguage={dynamicIRsByLanguage}
            lang={lang}
        />
    );
    const responseCard = (
        <PlaygroundResponseCard
            response={response}
            sendRequest={sendRequest}
            requestDisabled={requestDisabled ?? false}
            lang={lang}
            getCurlCommand={getCurlCommand}
        />
    );

    return (
        <PlaygroundEndpointContentLayout
            endpointId={context.endpoint.id}
            sendRequest={sendRequest}
            form={form}
            requestCard={requestCard}
            responseCard={responseCard}
            requestDisabled={requestDisabled ?? false}
            lang={lang}
            mobileTab={mobileTab}
            onMobileTabChange={onMobileTabChange}
        />
    );
}

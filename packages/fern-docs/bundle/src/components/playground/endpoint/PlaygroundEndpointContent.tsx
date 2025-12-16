import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import type { Loadable } from "@fern-ui/loadable";
import { type Dispatch, type ReactElement, type SetStateAction, useDeferredValue } from "react";

import type { PlaygroundEndpointRequestFormState } from "../types";
import type { PlaygroundResponse } from "../types/playgroundResponse";
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
                examples={context.endpoint.examples}
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

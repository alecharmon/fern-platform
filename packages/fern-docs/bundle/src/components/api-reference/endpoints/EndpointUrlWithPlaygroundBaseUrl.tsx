"use client";

import type { HttpOrWssOrGrpc } from "@fern-api/docs-utils";
import type { EndpointDefinition, WebSocketChannel } from "@fern-api/fdr-sdk/api-definition";

import { EndpointUrlWithOverflow } from "@fern-docs/components/api-reference/endpoints/EndpointUrlWithOverflow";

import { MaybeEnvironmentDropdown } from "@/components/MaybeEnvironmentDropdown";

import { usePlaygroundBaseUrl } from "../../playground/utils/select-environment";

export function EndpointUrlWithPlaygroundBaseUrl({
    endpoint,
    className,
    method = "GET",
    lang
}: {
    endpoint: WebSocketChannel | EndpointDefinition;
    className?: string;
    method?: HttpOrWssOrGrpc;
    lang: string;
}) {
    const [baseUrl, environmentId] = usePlaygroundBaseUrl(endpoint);
    return (
        <EndpointUrlWithOverflow
            baseUrl={baseUrl}
            environmentId={environmentId}
            path={endpoint.path}
            method={"method" in endpoint ? endpoint.method : method}
            options={endpoint.environments}
            showEnvironment
            large
            className={className}
            lang={lang}
            renderEnvironmentDropdown={(props) => (
                <MaybeEnvironmentDropdown
                    baseUrl={props.baseUrl}
                    environmentId={props.environmentId}
                    options={props.options}
                    urlTextStyle={props.urlTextStyle}
                    protocolTextStyle={props.protocolTextStyle}
                    isEditingEnvironment={props.isEditingEnvironment}
                    editable={props.editable}
                    lang={props.lang}
                    readonly={props.readonly}
                />
            )}
        />
    );
}

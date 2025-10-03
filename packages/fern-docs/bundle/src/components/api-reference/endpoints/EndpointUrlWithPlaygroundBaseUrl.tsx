"use client";

import { HttpOrWssOrGrpc } from "@fern-api/docs-utils";
import { EndpointDefinition, WebSocketChannel } from "@fern-api/fdr-sdk/api-definition";

import { usePlaygroundBaseUrl } from "../../playground/utils/select-environment";
import { EndpointUrlWithOverflow } from "./EndpointUrlWithOverflow";

export function EndpointUrlWithPlaygroundBaseUrl({
    endpoint,
    className,
    method = "GET"
}: {
    endpoint: WebSocketChannel | EndpointDefinition;
    className?: string;
    method?: HttpOrWssOrGrpc;
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
        />
    );
}

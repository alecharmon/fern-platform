import type {
    Environment,
    EnvironmentId,
    HttpMethod,
    ObjectProperty,
    PathPart,
    TypeDefinition,
    TypeId
} from "@fern-api/fdr-sdk/api-definition";
import { buildRequestUrl, unwrapReference } from "@fern-api/fdr-sdk/api-definition";
import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import unknownToString from "@fern-api/ui-core-utils/unknownToString";
import visitDiscriminatedUnion from "@fern-api/ui-core-utils/visitDiscriminatedUnion";
import { HttpMethodBadge } from "@fern-docs/components/badges";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { useBooleanState } from "@fern-ui/react-commons";
import { omitBy } from "es-toolkit/object";
import { isUndefined } from "es-toolkit/predicate";
import qs from "qs";
import { type FC, Fragment, type ReactNode } from "react";

import { MaybeEnvironmentDropdown } from "@/components/MaybeEnvironmentDropdown";
import { useAllEnvironmentIds } from "@/state/environment";

import { closeButton } from "../PlaygroundCloseButton";
import { PlaygroundSendRequestButton } from "../PlaygroundSendRequestButton";
import type { PlaygroundRequestFormState } from "../types";
import { isLocal } from "../utils/utils";

interface PlaygroundEndpointPathProps {
    method: HttpMethod | undefined;
    environmentId: EnvironmentId | undefined;
    baseUrl: string | undefined;
    options: Environment[] | undefined;
    formState: PlaygroundRequestFormState;
    path: PathPart[];
    queryParameters: ObjectProperty[] | undefined;
    sendRequest: () => void;
    sendRequestButtonLabel?: string;
    sendRequestIcon?: ReactNode;
    types: Record<TypeId, TypeDefinition>;
    apiDefinitionId?: FdrAPI.ApiDefinitionId;
    lang: string;
}

export const PlaygroundEndpointPath: FC<PlaygroundEndpointPathProps> = ({
    environmentId,
    baseUrl,
    options,
    method,
    formState,
    path,
    queryParameters,
    sendRequest,
    sendRequestButtonLabel,
    sendRequestIcon,
    types,
    apiDefinitionId,
    lang
}) => {
    const environmentIds = useAllEnvironmentIds();
    const isEditingEnvironment = useBooleanState(false);
    const requestDisabled = !isLocal() && baseUrl?.includes("localhost");

    return (
        <div className="playground-endpoint">
            <div className="bg-(color:--grayscale-a3) rounded-2 sm:rounded-5 flex h-10 min-w-0 flex-1 shrink items-center gap-2 px-4 py-2 max-sm:h-8 max-sm:px-2 max-sm:py-1">
                {method != null && <HttpMethodBadge method={method} className="playground-endpoint-method" />}
                <span
                    className={cn(
                        environmentIds.length > 1 ? "playground-endpoint-url-with-switcher" : "playground-endpoint-url",
                        "flex w-full flex-row",
                        "items-baseline"
                    )}
                >
                    <span className="playground-endpoint-baseurl max-sm:hidden">
                        <MaybeEnvironmentDropdown
                            environmentId={environmentId}
                            baseUrl={baseUrl}
                            options={options}
                            small
                            urlTextStyle="playground-endpoint-baseurl max-sm:hidden"
                            protocolTextStyle="playground-endpoint-baseurl max-sm:hidden"
                            editable
                            isEditingEnvironment={isEditingEnvironment}
                            apiDefinitionId={apiDefinitionId}
                            lang={lang}
                        />
                    </span>
                    {path.map((part, idx) => {
                        return visitDiscriminatedUnion(part, "type")._visit({
                            literal: (literal) => <span key={idx}>{literal.value}</span>,
                            pathParameter: (pathParameter) => {
                                const stateValue = unknownToString(formState.pathParameters[pathParameter.value]);
                                return (
                                    <span
                                        key={idx}
                                        className={cn({
                                            "text-(color:--accent-a11) bg-(color:--accent-a3) rounded-1 px-1 before:content-[':']":
                                                stateValue.length === 0,
                                            "text-(color:--accent-a11) font-semibold": stateValue.length > 0
                                        })}
                                    >
                                        {stateValue.length > 0 ? encodeURI(stateValue) : pathParameter.value}
                                    </span>
                                );
                            },
                            _other: () => null
                        });
                    })}
                    {queryParameters &&
                        queryParameters.length > 0 &&
                        Object.keys(omitBy(formState.queryParameters, isUndefined)).length > 0 &&
                        (() => {
                            const filteredParams: Record<string, unknown> = {};

                            queryParameters
                                .filter((queryParameter) => {
                                    const stateValue = formState.queryParameters[queryParameter.key];
                                    const unwrapped = unwrapReference(queryParameter.valueShape, types);
                                    if (stateValue == null && unwrapped.isOptional) {
                                        return false;
                                    }
                                    return true;
                                })
                                .forEach((queryParameter) => {
                                    const stateValue = formState.queryParameters[queryParameter.key];
                                    if (stateValue != null) {
                                        filteredParams[queryParameter.key] = stateValue;
                                    }
                                });

                            const queryString = qs.stringify(filteredParams, {
                                encode: false,
                                arrayFormat: "repeat"
                            });

                            if (!queryString) return null;

                            const pairs = queryString.split("&").map((pair) => {
                                const [key, value] = pair.split("=");
                                return { key, value };
                            });

                            return pairs.map(({ key, value }, idx) => (
                                <Fragment key={idx}>
                                    <span>{idx === 0 ? "?" : "&"}</span>
                                    <span>{key}</span>
                                    <span>{"="}</span>
                                    <span className={"text-(color:--accent-a11) font-semibold"}>{value}</span>
                                </Fragment>
                            ));
                        })()}
                </span>
                <CopyToClipboardButton
                    className="playground-endpoint-copy-button"
                    content={() =>
                        buildRequestUrl({
                            path,
                            pathParameters: formState.pathParameters,
                            queryParameters: formState.queryParameters,
                            baseUrl
                        })
                    }
                    lang={lang}
                />
            </div>

            <div className="max-sm:hidden">
                <PlaygroundSendRequestButton
                    sendRequest={sendRequest}
                    sendRequestButtonLabel={sendRequestButtonLabel}
                    sendRequestIcon={sendRequestIcon}
                    disabled={requestDisabled}
                    lang={lang}
                />
            </div>

            {<closeButton.Out />}
        </div>
    );
};

import type { HttpRequest, HttpResponse } from "@fern-api/fdr-sdk/api-definition";
import { Separator } from "@fern-docs/components/Separator";
import type { RESET } from "jotai/utils";
import React, { type SetStateAction } from "react";

export interface EndpointSectionProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
    hideSeparator?: boolean;
    multipleResponsesProps?: {
        responses: HttpResponse[];
        selectedResponse: HttpResponse;
        setSelectedResponse: (response: HttpResponse) => void;
        getResponseId: (response: HttpResponse) => React.JSX.Element;
        setSelectedExampleKey: (update: typeof RESET | SetStateAction<any>) => void;
    };
    multipleRequestsProps?: {
        requests: HttpRequest[];
        selectedRequest: HttpRequest;
        setSelectedRequest: (request: HttpRequest) => void;
        getRequestId: (request: HttpRequest) => React.JSX.Element;
    };
    ErrorBoundary?: React.ComponentType<{ children: React.ReactNode }>;
    SectionContainer: React.ComponentType<{
        children: React.ReactNode;
        className?: string;
    }>;
    TypeDefinitionAnchor: React.ComponentType<{ children: React.ReactNode }>;
    ResponseSelect?: React.ComponentType<{
        responses: HttpResponse[];
        selectedResponse: HttpResponse;
        setSelectedResponse: (response: HttpResponse) => void;
        getResponseId: (response: HttpResponse) => React.JSX.Element;
        setSelectedExampleKey: (update: typeof RESET | SetStateAction<any>) => void;
    }>;
    RequestSelect?: React.ComponentType<{
        requests: HttpRequest[];
        selectedRequest: HttpRequest;
        setSelectedRequest: (request: HttpRequest) => void;
        getRequestId: (request: HttpRequest) => React.JSX.Element;
    }>;
}

export function EndpointSection({
    title,
    description,
    children,
    hideSeparator,
    multipleResponsesProps,
    multipleRequestsProps,
    ErrorBoundary = React.Fragment,
    SectionContainer,
    TypeDefinitionAnchor,
    ResponseSelect,
    RequestSelect
}: EndpointSectionProps) {
    return (
        <ErrorBoundary>
            <SectionContainer className="space-y-3">
                <TypeDefinitionAnchor>
                    {multipleResponsesProps && ResponseSelect && (
                        <div className="mt-0 flex flex-row items-center gap-2">
                            <h3 className="mb-0 mt-0">{title}</h3>
                            <ResponseSelect
                                responses={multipleResponsesProps.responses}
                                selectedResponse={multipleResponsesProps.selectedResponse}
                                setSelectedResponse={multipleResponsesProps.setSelectedResponse}
                                getResponseId={multipleResponsesProps.getResponseId}
                                setSelectedExampleKey={multipleResponsesProps.setSelectedExampleKey}
                            />
                        </div>
                    )}
                    {multipleRequestsProps && RequestSelect && (
                        <div className="mt-0 flex flex-row items-center gap-2">
                            <h3 className="mb-0 mt-0">{title}</h3>
                            <RequestSelect
                                requests={multipleRequestsProps.requests}
                                selectedRequest={multipleRequestsProps.selectedRequest}
                                setSelectedRequest={multipleRequestsProps.setSelectedRequest}
                                getRequestId={multipleRequestsProps.getRequestId}
                            />
                        </div>
                    )}
                    {!multipleRequestsProps && !multipleResponsesProps && <h3 className="mt-0">{title}</h3>}
                </TypeDefinitionAnchor>
                {description}
                {hideSeparator ? null : <Separator />}
                {children}
            </SectionContainer>
        </ErrorBoundary>
    );
}

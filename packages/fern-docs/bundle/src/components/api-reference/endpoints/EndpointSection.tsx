import React, { SetStateAction } from "react";

import { RESET } from "jotai/utils";

import { HttpRequest, HttpResponse } from "@fern-api/fdr-sdk/api-definition";
import { Separator } from "@fern-docs/components/Separator";

import { ErrorBoundary } from "@/components/error-boundary";

import { SelectedExampleKey } from "../type-definitions/EndpointContent";
import { RequestSelect } from "./MultipleRequestsSelect";
import { ResponseSelect } from "./MultipleResponsesSelect";
import { SectionContainer, TypeDefinitionAnchor } from "./TypeDefinitionAnchor";

export function EndpointSection({
  title,
  description,
  children,
  hideSeparator,
  multipleResponsesProps,
  multipleRequestsProps,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  hideSeparator?: boolean;
  multipleResponsesProps?: {
    responses: HttpResponse[];
    selectedResponse: HttpResponse;
    setSelectedResponse: (response: HttpResponse) => void;
    getResponseId: (response: HttpResponse) => React.JSX.Element;
    setSelectedExampleKey: (
      update: typeof RESET | SetStateAction<SelectedExampleKey>
    ) => void;
  };
  multipleRequestsProps?: {
    requests: HttpRequest[];
    selectedRequest: HttpRequest;
    setSelectedRequest: (request: HttpRequest) => void;
    getRequestId: (request: HttpRequest) => React.JSX.Element;
  };
}) {
  return (
    <ErrorBoundary>
      <SectionContainer className="space-y-3">
        <TypeDefinitionAnchor>
          {multipleResponsesProps && (
            <div className="mt-0 flex flex-row items-center gap-2">
              <h3 className="mb-0 mt-0">{title}</h3>
              <ResponseSelect
                responses={multipleResponsesProps.responses}
                selectedResponse={multipleResponsesProps.selectedResponse}
                setSelectedResponse={multipleResponsesProps.setSelectedResponse}
                getResponseId={multipleResponsesProps.getResponseId}
                setSelectedExampleKey={
                  multipleResponsesProps.setSelectedExampleKey
                }
              />
            </div>
          )}
          {multipleRequestsProps && (
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
          {!multipleRequestsProps && !multipleResponsesProps && (
            <h3 className="mt-0">{title}</h3>
          )}
        </TypeDefinitionAnchor>
        {description}
        {hideSeparator ? null : <Separator />}
        {children}
      </SectionContainer>
    </ErrorBoundary>
  );
}

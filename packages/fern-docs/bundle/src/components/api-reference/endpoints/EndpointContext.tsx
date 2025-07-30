"use client";

import React from "react";

import { noop } from "ts-essentials";

import {
  EndpointDefinition,
  ErrorResponse,
  HttpRequest,
  HttpResponse,
  Protocol,
} from "@fern-api/fdr-sdk/api-definition";
import { useCurrentAnchor } from "@fern-docs/components/hooks/use-anchor";

import { useExampleSelection } from "./useExampleSelection";
import { convertNameToAnchorPart } from "./utils";

export const EndpointContext = React.createContext<
  {
    selectedError: ErrorResponse | undefined;
    setSelectedError: (error: ErrorResponse | undefined) => void;
    selectedResponse: HttpResponse | undefined;
    setSelectedResponse: (response: HttpResponse | undefined) => void;
    setSelectedResponseByStatusCode: (
      statusCode: number | string | undefined
    ) => void;
    selectedRequest: HttpRequest | undefined;
    setSelectedRequest: (request: HttpRequest | undefined) => void;
    endpointProtocol: Protocol | undefined;
  } & Omit<ReturnType<typeof useExampleSelection>, "defaultLanguage">
>({
  selectedError: undefined,
  setSelectedError: noop,
  selectedResponse: undefined,
  setSelectedResponse: noop,
  setSelectedResponseByStatusCode: noop,
  selectedRequest: undefined,
  setSelectedRequest: noop,
  selectedExample: undefined,
  examplesByStatusCode: {},
  examplesByKeyAndStatusCode: {},
  selectedExampleKey: {
    language: "",
    statusCode: undefined,
    responseIndex: 0,
    exampleKey: undefined,
  },
  availableLanguages: [],
  setSelectedExampleKey: noop,
  endpointProtocol: undefined,
});

export function EndpointContextProvider({
  children,
  endpoint,
}: {
  children: React.ReactNode;
  endpoint: EndpointDefinition;
}) {
  const {
    selectedExample,
    examplesByStatusCode,
    examplesByKeyAndStatusCode,
    selectedExampleKey,
    availableLanguages,
    setSelectedExampleKey,
  } = useExampleSelection(endpoint);

  const [selectedResponse, setSelectedResponse] = React.useState<
    HttpResponse | undefined
  >(endpoint.responses?.[0]);

  const [selectedRequest, setSelectedRequest] = React.useState<
    HttpRequest | undefined
  >(endpoint.requests?.[0]);

  const responseByStatusCode = React.useMemo(() => {
    const map: Record<string, HttpResponse> = {};
    endpoint.responses?.forEach((response) => {
      map[String(response.statusCode)] = response;
    });
    return map;
  }, [endpoint.responses]);

  const setSelectedResponseByStatusCode = React.useCallback(
    (statusCode: number | string | undefined) => {
      if (statusCode != null) {
        const response = responseByStatusCode[String(statusCode)];
        if (response) {
          setSelectedResponse(response);
        }
      }
    },
    [responseByStatusCode, setSelectedResponse]
  );

  const setStatusCode = React.useCallback(
    (statusCode: number | string | undefined) => {
      setSelectedExampleKey((prev) => {
        if (prev.statusCode === String(statusCode)) {
          return prev;
        }
        return {
          ...prev,
          statusCode: statusCode != null ? String(statusCode) : undefined,
          responseIndex: 0,
        };
      });
    },
    [setSelectedExampleKey]
  );

  const currentAnchor = useCurrentAnchor();

  React.useEffect(() => {
    const statusCodeOrName =
      maybeGetErrorStatusCodeOrNameFromAnchor(currentAnchor);
    if (statusCodeOrName != null) {
      const error = endpoint.errors?.find((e) =>
        typeof statusCodeOrName === "number"
          ? e.statusCode === statusCodeOrName
          : convertNameToAnchorPart(e.name) === statusCodeOrName
      );
      if (error != null) {
        setStatusCode(error.statusCode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnchor]);

  const selectedError = endpoint.errors?.find(
    (e) =>
      e.statusCode ===
      (selectedExample?.exampleCall.responseStatusCode ??
        selectedExampleKey.statusCode)
  );

  const handleSelectError = React.useCallback(
    (error: ErrorResponse | undefined) => {
      setStatusCode(error?.statusCode);
    },
    [setStatusCode]
  );

  const value = React.useMemo(
    () => ({
      selectedError,
      setSelectedError: handleSelectError,
      selectedResponse,
      setSelectedResponse,
      setSelectedResponseByStatusCode,
      selectedRequest,
      setSelectedRequest,
      selectedExample,
      examplesByStatusCode,
      examplesByKeyAndStatusCode,
      selectedExampleKey,
      availableLanguages,
      setSelectedExampleKey,
      endpointProtocol: endpoint.protocol,
    }),
    [
      selectedError,
      handleSelectError,
      selectedResponse,
      setSelectedResponse,
      setSelectedResponseByStatusCode,
      selectedRequest,
      setSelectedRequest,
      selectedExample,
      examplesByStatusCode,
      examplesByKeyAndStatusCode,
      selectedExampleKey,
      availableLanguages,
      setSelectedExampleKey,
      endpoint.protocol,
    ]
  );

  return (
    <EndpointContext.Provider value={value}>
      {children}
    </EndpointContext.Provider>
  );
}

export function useEndpointContext() {
  return React.useContext(EndpointContext);
}

const ERROR_ANCHOR_PREFIX = "response.error.";

function maybeGetErrorStatusCodeOrNameFromAnchor(
  anchor: string | undefined
): number | string | undefined {
  if (anchor?.startsWith(ERROR_ANCHOR_PREFIX)) {
    // error anchor format is response.error.{statusCode}.property.a.b.c
    // get {statusCode} from the anchor
    const statusCodeOrErrorName = anchor.split(".")[2];
    if (statusCodeOrErrorName != null) {
      const statusCode = parseInt(statusCodeOrErrorName, 10);
      if (!isNaN(statusCode)) {
        return statusCode;
      } else {
        return statusCodeOrErrorName;
      }
    }
  }
  return undefined;
}

import { compact } from "es-toolkit/array";
import { mapValues, omitBy, pick } from "es-toolkit/object";

import { FernUser, PlaygroundState } from "@fern-api/docs-auth";
import type {
  EndpointContext,
  ObjectProperty,
} from "@fern-api/fdr-sdk/api-definition";
import { ExampleEndpointCall } from "@fern-api/fdr-sdk/api-definition";
import { EMPTY_OBJECT } from "@fern-api/ui-core-utils";

import type {
  PlaygroundEndpointRequestFormState,
  PlaygroundFormDataEntryValue,
} from "../types";
import {
  getEmptyValueForHttpRequestBody,
  getEmptyValueForObjectProperties,
} from "./default-values";

// returns a merged state of the environment-specific variables
// overlayed onto the intial state
// will be undefined if the initial and environment states are undefined
export function resolveEndpointEnvironmentState({
  currentEnvironment,
  initialState,
  envState,
}: {
  currentEnvironment: string | undefined;
  initialState:
    | NonNullable<FernUser["playground"]>["initial_state"]
    | undefined;
  envState: NonNullable<FernUser["playground"]>["env_state"] | undefined;
}): PlaygroundState | undefined {
  // if no environment present, fallback to initial
  if (!currentEnvironment) {
    return initialState;
  }

  // env_state key can match any part of the environment string
  // env_state: prod === environment_url: prod.example.com
  // env_state: company_a === environment: api.company_a.com

  // iterate over envState keys to find a match
  if (envState) {
    for (const [envKey, envStateValue] of Object.entries(envState)) {
      if (envKey && currentEnvironment.includes(envKey)) {
        // override or add any values in the initial state with the state defined in the env_state
        return {
          auth: envStateValue.auth ?? initialState?.auth,
          headers: {
            ...(initialState?.headers ?? {}),
            ...(envStateValue.headers ?? {}),
          },
          path_parameters: {
            ...(initialState?.path_parameters ?? {}),
            ...(envStateValue.path_parameters ?? {}),
          },
          query_parameters: {
            ...(initialState?.query_parameters ?? {}),
            ...(envStateValue.query_parameters ?? {}),
          },
        };
      }
    }
  }

  // if no match, fallback to initial
  return initialState;
}

export function getInitialEndpointRequestFormStateWithExample(
  context: EndpointContext | undefined,
  exampleCall: ExampleEndpointCall | undefined,
  playgroundState: NonNullable<PlaygroundState> | undefined
): PlaygroundEndpointRequestFormState {
  return {
    type: "endpoint",
    headers: {
      ...getEmptyValueForObjectProperties(
        compact([
          context?.globalHeaders,
          context?.endpoint.requestHeaders,
        ]).flat(),
        context?.types ?? EMPTY_OBJECT
      ),
      ...(exampleCall?.headers ?? {}),
      ...filterParams(
        playgroundState?.headers ?? {},
        compact([
          context?.globalHeaders,
          context?.endpoint.requestHeaders,
        ]).flat()
      ),
    },
    pathParameters: {
      ...getEmptyValueForObjectProperties(
        context?.endpoint.pathParameters ?? [],
        context?.types ?? EMPTY_OBJECT
      ),
      ...exampleCall?.pathParameters,
      ...filterParams(
        playgroundState?.path_parameters ?? {},
        context?.endpoint.pathParameters ?? []
      ),
    },
    queryParameters: {
      ...getEmptyValueForObjectProperties(
        context?.endpoint.queryParameters ?? [],
        context?.types ?? EMPTY_OBJECT
      ),
      ...exampleCall?.queryParameters,
      ...filterParams(
        playgroundState?.query_parameters ?? {},
        context?.endpoint.queryParameters ?? []
      ),
    },
    body:
      exampleCall != null
        ? exampleCall?.requestBody?.type === "form"
          ? {
              type: "form-data",
              value: omitUndefinedValues(
                mapValues(
                  exampleCall.requestBody.value,
                  (exampleValue): PlaygroundFormDataEntryValue | undefined =>
                    exampleValue.type === "filename" ||
                    exampleValue.type === "filenameWithData"
                      ? { type: "file", value: undefined }
                      : exampleValue.type === "filenames" ||
                          exampleValue.type === "filenamesWithData"
                        ? { type: "fileArray", value: [] }
                        : exampleValue.type === "json" &&
                            exampleValue.value !== undefined
                          ? {
                              type: "json",
                              value: exampleValue.value,
                            }
                          : undefined
                )
              ),
            }
          : exampleCall?.requestBody?.type === "bytes"
            ? { type: "octet-stream", value: undefined }
            : { type: "json", value: exampleCall?.requestBody?.value }
        : getEmptyValueForHttpRequestBody(
            context?.endpoint.requests?.[0]?.body,
            context?.types ?? EMPTY_OBJECT
          ),
  };
}

function omitUndefinedValues<T>(
  record: Record<string, T>
): Record<string, NonNullable<T>> {
  return omitBy(record, (value) => value == null) as Record<
    string,
    NonNullable<T>
  >;
}

function filterParams(
  initialStateParams: Record<string, string>,
  requestParams: ObjectProperty[]
): Record<string, string> {
  return pick(
    initialStateParams,
    requestParams.map((param) => param.key)
  );
}

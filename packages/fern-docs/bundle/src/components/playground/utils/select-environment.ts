import {
  EndpointDefinition,
  Environment,
  EnvironmentId,
  WebSocketChannel,
} from "@fern-api/fdr-sdk/api-definition";
import { sanitizeUrl } from "@fern-api/ui-core-utils";

import {
  useSelectedEnvironmentId,
  useSelectedEnvironmentUrl,
} from "@/state/environment";

function selectEnvironment(
  endpoint: WebSocketChannel | EndpointDefinition,
  selectedEnvironmentId?: string
): Environment | undefined {
  return (
    endpoint.environments?.find(
      (environment) => environment.id === selectedEnvironmentId
    ) ??
    endpoint.environments?.find(
      (environment) => environment.id === endpoint.defaultEnvironment
    ) ??
    endpoint.environments?.[0]
  );
}

export function useSelectedEnvironment(
  endpoint: WebSocketChannel | EndpointDefinition
): Environment | undefined {
  const selectedEnvironmentId = useSelectedEnvironmentId();
  return selectEnvironment(endpoint, selectedEnvironmentId);
}

export function usePlaygroundBaseUrl(
  endpoint: WebSocketChannel | EndpointDefinition
): [baseUrl: string | undefined, environmentId: EnvironmentId | undefined] {
  const environment = useSelectedEnvironment(endpoint);
  const sanitizedBaseUrl = sanitizeUrl(environment?.baseUrl);
  const sanitizedPlaygroundUrl = useSelectedEnvironmentUrl();

  // if there is a protocol mismatch, force an update to the base url
  if (
    sanitizedPlaygroundUrl?.substring(0, 5) !==
    sanitizedBaseUrl?.substring(0, 5)
  ) {
    return [sanitizedBaseUrl, environment?.id];
  }

  // prefer the user-set playground URL, if available
  return [sanitizedPlaygroundUrl ?? sanitizedBaseUrl, environment?.id];
}

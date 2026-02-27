import type { ApiDefinition } from "@fern-api/fdr-sdk";
import { dump as yamlStringify } from "js-yaml";

import { generateOpenApiSpec } from "./generateOpenApiSpec";

/**
 * Generates OpenAPI YAML for a single endpoint or webhook.
 *
 * Internally builds a minimal ApiDefinition containing only the target
 * endpoint/webhook and delegates to the shared `generateOpenApiSpec`.
 */
export class OpenApiYamlFormatter {
    public generateYamlFromEndpoint(
        endpoint: ApiDefinition.EndpointDefinition,
        apiDefinition?: ApiDefinition.ApiDefinition
    ): string {
        const endpointId = endpoint.id as ApiDefinition.EndpointId;
        const minimalApiDef: ApiDefinition.ApiDefinition = {
            id: apiDefinition?.id ?? ("" as ApiDefinition.ApiDefinitionId),
            apiName: apiDefinition?.apiName,
            endpoints: { [endpointId]: endpoint },
            websockets: {},
            webhooks: {},
            types: apiDefinition?.types ?? {},
            subpackages: apiDefinition?.subpackages ?? {},
            auths: apiDefinition?.auths ?? {},
            globalHeaders: apiDefinition?.globalHeaders,
            graphqlOperations: {},
            snippetsConfiguration: apiDefinition?.snippetsConfiguration
        };
        const spec = generateOpenApiSpec(minimalApiDef);
        return yamlStringify(spec);
    }

    public generateYamlFromWebhook(
        webhook: ApiDefinition.WebhookDefinition,
        apiDefinition?: ApiDefinition.ApiDefinition
    ): string {
        const webhookId = webhook.id as ApiDefinition.WebhookId;
        const minimalApiDef: ApiDefinition.ApiDefinition = {
            id: apiDefinition?.id ?? ("" as ApiDefinition.ApiDefinitionId),
            apiName: apiDefinition?.apiName,
            endpoints: {},
            websockets: {},
            webhooks: { [webhookId]: webhook },
            types: apiDefinition?.types ?? {},
            subpackages: apiDefinition?.subpackages ?? {},
            auths: apiDefinition?.auths ?? {},
            globalHeaders: apiDefinition?.globalHeaders,
            graphqlOperations: {},
            snippetsConfiguration: apiDefinition?.snippetsConfiguration
        };
        const spec = generateOpenApiSpec(minimalApiDef);
        return yamlStringify(spec);
    }
}

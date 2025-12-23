import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import urljoin from "url-join";

export function findEndpoint({
    apiDefinition,
    method,
    path,
    example: exampleName
}: {
    apiDefinition: ApiDefinition.ApiDefinition;
    method: string;
    path: string;
    example: string | undefined;
}): ApiDefinition.EndpointDefinition | undefined {
    path = path.startsWith("/") ? path : `/${path}`;
    const matchingEndpoints = Object.values(apiDefinition.endpoints).filter(
        (e) => e.method === method && getMatchablePermutationsForEndpoint(e).has(path)
    );

    if (exampleName != null && matchingEndpoints.length > 1) {
        return (
            matchingEndpoints.find((e) => e.examples?.some(createExampleNamePredicate(exampleName))) ??
            matchingEndpoints[0]
        );
    }

    return matchingEndpoints[0];
}

function createExampleNamePredicate(exampleName: string): (example: ApiDefinition.ExampleEndpointCall) => boolean {
    return (example) =>
        example.name === exampleName ||
        Object.values(example.snippets ?? {})
            .flat()
            .some((snippet) => snippet.name === exampleName);
}

export function getMatchablePermutationsForEndpoint(
    endpoint: Pick<ApiDefinition.EndpointDefinition, "path" | "environments">
): Set<string> {
    const path1 = ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path);
    const path2 = ApiDefinition.toColonEndpointPathLiteral(endpoint.path);
    const possiblePaths = new Set<string>([path1, path2]);
    endpoint.environments?.forEach((env) => {
        const fullUrl1 = urljoin(env.baseUrl, path1);
        const fullUrl2 = urljoin(env.baseUrl, path2);
        possiblePaths.add(fullUrl1);
        possiblePaths.add(fullUrl2);

        try {
            const parsedUrl = new URL(env.baseUrl);
            const basePath = parsedUrl.pathname + parsedUrl.search;
            if (basePath !== "" && basePath !== undefined) {
                const urlWithBasePath1 = urljoin(basePath, path1);
                const urlWithBasePath2 = urljoin(basePath, path2);
                possiblePaths.add(urlWithBasePath1);
                possiblePaths.add(urlWithBasePath2);
            }
        } catch {
            // If URL parsing fails, skip adding base path variations
        }
    });
    return possiblePaths;
}

/**
 * Converts a camelCase string to kebab-case.
 * e.g., "onOrderCreated" -> "on-order-created"
 */
function camelToKebab(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Find a webhook by its ID, operationId, or path.
 * Webhooks can be identified by:
 * - Exact ID (e.g., "subpackage_orders.onOrderCreated")
 * - Operation ID (e.g., "on-order-created")
 * - ID suffix after the last dot (e.g., "onOrderCreated")
 * - camelCase converted to kebab-case for operationId matching (e.g., "onOrderCreated" -> "on-order-created")
 * - Path (e.g., "/webhooks/my-webhook")
 */
export function findWebhook({
    apiDefinition,
    webhookId
}: {
    apiDefinition: ApiDefinition.ApiDefinition;
    webhookId: string;
}): ApiDefinition.WebhookDefinition | undefined {
    const webhooks = Object.values(apiDefinition.webhooks);

    // First, try to find by exact ID match
    const webhookById = webhooks.find((w) => w.id === webhookId);
    if (webhookById != null) {
        return webhookById;
    }

    // Then, try to find by operationId match (exact)
    const webhookByOperationId = webhooks.find((w) => w.operationId === webhookId);
    if (webhookByOperationId != null) {
        return webhookByOperationId;
    }

    // Then, try to find by operationId match with camelCase to kebab-case conversion
    // e.g., "onOrderCreated" -> "on-order-created"
    const kebabWebhookId = camelToKebab(webhookId);
    if (kebabWebhookId !== webhookId) {
        const webhookByKebabOperationId = webhooks.find((w) => w.operationId === kebabWebhookId);
        if (webhookByKebabOperationId != null) {
            return webhookByKebabOperationId;
        }
    }

    // Then, try to find by ID suffix (part after the last dot)
    // e.g., "onOrderCreated" matches "subpackage_orders.onOrderCreated"
    const webhooksBySuffix = webhooks.filter((w) => {
        const lastDotIndex = w.id.lastIndexOf(".");
        if (lastDotIndex === -1) {
            return false;
        }
        const suffix = w.id.slice(lastDotIndex + 1);
        return suffix === webhookId;
    });
    // Only return if there's exactly one match to avoid ambiguity
    if (webhooksBySuffix.length === 1) {
        return webhooksBySuffix[0];
    }

    // Then, try to find by path match
    const normalizedPath = webhookId.startsWith("/") ? webhookId : `/${webhookId}`;
    const webhookByPath = webhooks.find((w) => {
        const webhookPath = "/" + w.path.join("/");
        return webhookPath === normalizedPath;
    });

    return webhookByPath;
}

import { PostmanFernIntegrationServiceClient } from "@fern-api/postman-fern-integration-service-client";

export function getPostmanFernIntegrationServiceClient({
    token
}: {
    token: string;
}): PostmanFernIntegrationServiceClient {
    return new PostmanFernIntegrationServiceClient({
        environment: getPostmanFernIntegrationServiceBaseUrl(),
        token
    });
}

function getPostmanFernIntegrationServiceBaseUrl(): string {
    const baseUrl = process.env.POSTMAN_FERN_INTEGRATION_SERVICE_URL;
    if (!baseUrl) {
        return "https://api.getpostman.com";
    }
    return baseUrl;
}

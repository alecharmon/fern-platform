import { FdrLambda, FdrLambdaClient } from "@fern-api/fdr-lambda-sdk";
import type { ApiDefinition } from "@fern-api/fdr-sdk";
import { getDocsServiceJWT, getFdrLambdaOrigin, isSelfHosted } from "./fdr-client-utils";

let fdrLambdaClientInstance: FdrLambdaClient | null = null;

async function getFdrLambdaClient(): Promise<FdrLambdaClient> {
    if (fdrLambdaClientInstance == null) {
        const token = isSelfHosted() ? "" : await getDocsServiceJWT();
        fdrLambdaClientInstance = new FdrLambdaClient({
            environment: getFdrLambdaOrigin(),
            token
        });
    }
    return fdrLambdaClientInstance;
}

/**
 * Lazily loads a single API definition by its ID.
 * Returns undefined if the API could not be loaded.
 *
 * @param apiDefinitionId - The API definition ID to load
 * @returns The API definition or undefined if loading failed
 */
export async function loadApiById(
    apiDefinitionId: ApiDefinition.ApiDefinitionId
): Promise<ApiDefinition.ApiDefinition | undefined> {
    try {
        const client = await getFdrLambdaClient();
        console.log(`[loadApiById] Loading API: ${apiDefinitionId}`);

        const apiResponse = await client.api.v1.read.getApiDefinitionFull(
            FdrLambda.ApiDefinitionId(apiDefinitionId as string)
        );

        if (apiResponse.ok) {
            // The FDR Lambda SDK returns a slightly different type than FDR SDK.
            // FDR SDK's ApiDefinition includes graphqlOperations which Lambda SDK doesn't have.
            // The runtime values are compatible, we just need to add the missing field and cast.
            return {
                ...apiResponse.body,
                graphqlOperations: {}
            } as unknown as ApiDefinition.ApiDefinition;
        } else {
            console.error(`[loadApiById] Failed to load API ${apiDefinitionId}: ${apiResponse.error}`);
            return undefined;
        }
    } catch (error) {
        console.error(`[loadApiById] Error loading API ${apiDefinitionId}:`, error);
        return undefined;
    }
}

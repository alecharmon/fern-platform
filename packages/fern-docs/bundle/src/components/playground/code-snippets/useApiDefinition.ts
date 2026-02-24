import { provideRegistryService } from "@fern-api/docs-server/registry";
import type { APIV1Read, FdrAPI } from "@fern-api/fdr-sdk/client/types";
import useSWRImmutable from "swr/immutable";

export function useApiDefinition(
    apiId: FdrAPI.ApiDefinitionId,
    isSnippetTemplatesEnabled: boolean
): APIV1Read.ApiDefinition | undefined {
    const { data } = useSWRImmutable(apiId, async (apiId) => {
        if (!isSnippetTemplatesEnabled) {
            return undefined;
        }
        try {
            return await provideRegistryService().api.read.getApi({ apiDefinitionId: apiId });
        } catch {
            return undefined;
        }
    });

    return data ?? undefined;
}

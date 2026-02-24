import { mapValues } from "es-toolkit/object";

import { ApiDefinition } from "../..";
import type { DocsV2Read } from "../../client";

export function toApis(docs: DocsV2Read.LoadDocsForUrlResponse) {
    return {
        ...mapValues(docs.definition.apis, (api) =>
            ApiDefinition.ApiDefinitionV1ToLatest.from(
                api as Parameters<typeof ApiDefinition.ApiDefinitionV1ToLatest.from>[0]
            ).migrate()
        ),
        ...(docs.definition.apisV2 as Record<string, ApiDefinition.ApiDefinition>)
    };
}

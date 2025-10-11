import { mapValues } from "es-toolkit/object";

import { ApiDefinition } from "../..";
import type { DocsV2Read } from "../../client";

export function toApis(docs: DocsV2Read.LoadDocsForUrlResponse) {
    return {
        ...mapValues(docs.definition.apis, (api) => ApiDefinition.ApiDefinitionV1ToLatest.from(api).migrate()),
        ...docs.definition.apisV2
    };
}

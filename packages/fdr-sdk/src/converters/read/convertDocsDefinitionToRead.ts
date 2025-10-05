import { mapValues } from "es-toolkit/object";

import type { APIV1Db, APIV1Read, DocsV1Db, DocsV1Read } from "../../client";
import type { FernRegistry } from "../../client/generated";
import { convertDbDocsConfigToRead } from "./convertDbDocsConfigToRead";

export function convertDocsDefinitionToRead({
    docsDbDefinition,
    filesV2,
    apis,
    apisV2,
    id
}: {
    docsDbDefinition: DocsV1Db.DocsDefinitionDb;
    filesV2: Record<DocsV1Read.FileId, DocsV1Read.File_>;
    apis: Record<DocsV1Db.ApiDefinitionId, APIV1Read.ApiDefinition>;
    apisV2: Record<FernRegistry.ApiDefinitionId, FernRegistry.api.latest.ApiDefinition>;
    id: APIV1Db.DocsConfigId | undefined;
}): DocsV1Read.DocsDefinition {
    return {
        pages: docsDbDefinition.pages,
        apis,
        apisV2,
        files: mapValues(filesV2, (fileV2) => fileV2.url),
        filesV2,
        jsFiles: docsDbDefinition.type === "v3" ? docsDbDefinition.jsFiles : undefined,
        id,
        config: convertDbDocsConfigToRead({ dbShape: docsDbDefinition.config })
    };
}

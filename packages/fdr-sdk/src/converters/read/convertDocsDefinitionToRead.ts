import { mapValues } from "es-toolkit/object";
import type { APIV1Db, APIV1Read, DocsV1Db } from "../../client";
import { DocsV1Read } from "../../client";
import { convertDbDocsConfigToRead } from "./convertDbDocsConfigToRead";

export function convertDocsDefinitionToRead({
    docsDbDefinition,
    filesV2,
    apis,
    apisV2,
    id,
    apiNameToId
}: {
    docsDbDefinition: DocsV1Db.DocsDefinitionDb;
    filesV2: Record<DocsV1Read.FileId, DocsV1Read.File_>;
    apis: Record<DocsV1Db.ApiDefinitionId, APIV1Read.ApiDefinition>;
    apisV2: Record<string, unknown>;
    id: APIV1Db.DocsConfigId | undefined;
    apiNameToId?: Record<string, string>;
}): DocsV1Read.DocsDefinition {
    return {
        pages: docsDbDefinition.pages,
        apis: Object.fromEntries(
            Object.entries(apis).map(([apiDefinitionId, api]) => [DocsV1Read.ApiDefinitionId(apiDefinitionId), api])
        ),
        apisV2: Object.fromEntries(
            Object.entries(apisV2).map(([apiDefinitionId, api]) => [DocsV1Read.ApiDefinitionId(apiDefinitionId), api])
        ),
        apiNameToId:
            apiNameToId != null
                ? mapValues(apiNameToId, (apiDefinitionId) => DocsV1Read.ApiDefinitionId(apiDefinitionId))
                : undefined,
        files: mapValues(filesV2, (fileV2) => fileV2.url as DocsV1Read.Url),
        filesV2,
        jsFiles: docsDbDefinition.type === "v3" ? docsDbDefinition.jsFiles : undefined,
        id: id != null ? DocsV1Read.DocsConfigId(id) : undefined,
        config: convertDbDocsConfigToRead({ dbShape: docsDbDefinition.config })
    };
}

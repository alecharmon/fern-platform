import { type DocsV1Db, DocsV1Read } from "@fern-api/fdr-sdk";

import type { FdrApplication } from "../app";

export async function getFilesV2(docsDbDefinition: DocsV1Db.DocsDefinitionDb, app: FdrApplication) {
    let promisedFiles: Promise<[DocsV1Read.FileId, DocsV1Read.File_]>[];
    if (docsDbDefinition.type === "v3") {
        promisedFiles = Object.entries(docsDbDefinition.files)
            .filter(([, info]) => info != null)
            .map(async ([fileId, fileDbInfo]): Promise<[DocsV1Read.FileId, DocsV1Read.File_]> => {
                const info = fileDbInfo!;
                const s3DownloadUrl = await app.services.s3.getPresignedDocsAssetsDownloadUrl({
                    key: info.s3Key,
                    isPrivate: !app.config.localModeOverride // for backcompat
                });
                const readFile: DocsV1Read.File_ =
                    info.type === "image"
                        ? {
                              type: "image",
                              url: s3DownloadUrl,
                              width: info.width,
                              height: info.height,
                              blurDataUrl: info.blurDataUrl,
                              alt: info.alt
                          }
                        : { type: "url", url: s3DownloadUrl };
                return [DocsV1Read.FileId(fileId), readFile];
            });
    } else {
        promisedFiles = Object.entries(docsDbDefinition.files)
            .filter(([, info]) => info != null)
            .map(async ([fileId, fileDbInfo]): Promise<[DocsV1Read.FileId, DocsV1Read.File_]> => {
                const info = fileDbInfo!;
                const s3DownloadUrl = await app.services.s3.getPresignedDocsAssetsDownloadUrl({
                    key: info.s3Key,
                    isPrivate: !app.config.localModeOverride // for backcompat
                });
                return [DocsV1Read.FileId(fileId), { type: "url", url: s3DownloadUrl }];
            });
    }
    return Object.fromEntries(await Promise.all(promisedFiles));
}

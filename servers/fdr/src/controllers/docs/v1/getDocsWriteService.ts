import { convertDocsDefinitionToDb, DocsV1Write, type FdrAPI } from "@fern-api/fdr-sdk";
import { FinishDocsRegisterV1InputSchema, StartDocsRegisterV1InputSchema } from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";

export * as WriteSchemas from "./write";

import { v4 as uuidv4 } from "uuid";

import type { FdrApplication } from "../../../app";
import type { S3DocsFileInfo } from "../../../services/s3";
import { writeBuffer } from "../../../util";

const DOCS_REGISTRATIONS: Record<string, DocsRegistrationInfo> = {};

interface DocsRegistrationInfo {
    domain: string;
    orgId: FdrAPI.OrgId;
    s3FileInfos: Record<DocsV1Write.FilePath, S3DocsFileInfo>;
}

export function createDocsV1WriteRouter(app: FdrApplication) {
    const startDocsRegister = os
        .route({ method: "POST", path: "/init" })
        .input(StartDocsRegisterV1InputSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: input.orgId
            });
            const docsRegistrationId = DocsV1Write.DocsRegistrationId(uuidv4());
            const { fileInfos, skippedFiles } = await app.services.s3.getPresignedDocsAssetsUploadUrls({
                domain: input.domain,
                filepaths: input.filepaths as DocsV1Write.FilePath[],
                images: [],
                isPrivate: true
            });
            DOCS_REGISTRATIONS[docsRegistrationId] = {
                domain: input.domain,
                orgId: input.orgId as FdrAPI.OrgId,
                s3FileInfos: fileInfos
            };
            return {
                docsRegistrationId,
                uploadUrls: Object.fromEntries(
                    Object.entries(fileInfos).map(([filepath, fileInfo]) => {
                        return [filepath, fileInfo.presignedUrl];
                    })
                ),
                skippedFiles
            };
        });

    const finishDocsRegister = os
        .route({ method: "POST", path: "/register/{docsRegistrationId}" })
        .input(FinishDocsRegisterV1InputSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            const docsRegistrationInfo = DOCS_REGISTRATIONS[input.docsRegistrationId];
            if (docsRegistrationInfo == null) {
                throw new ORPCError("NOT_FOUND", { message: "Docs registration ID not found" });
            }
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: docsRegistrationInfo.orgId
            });
            const dbDocsDefinition = convertDocsDefinitionToDb({
                writeShape: input.docsDefinition,
                files: docsRegistrationInfo.s3FileInfos
            });
            app.logger.info(
                `Docs for ${docsRegistrationInfo.orgId} has references to apis ${Array.from(
                    dbDocsDefinition.referencedApis
                ).join(", ")}`
            );
            await app.services.db.prisma.docs.upsert({
                create: {
                    url: docsRegistrationInfo.domain,
                    docsDefinition: writeBuffer(dbDocsDefinition)
                },
                update: {
                    docsDefinition: writeBuffer(dbDocsDefinition)
                },
                where: {
                    url: docsRegistrationInfo.domain
                }
            });
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete DOCS_REGISTRATIONS[input.docsRegistrationId];
            return undefined;
        });

    return { startDocsRegister, finishDocsRegister };
}

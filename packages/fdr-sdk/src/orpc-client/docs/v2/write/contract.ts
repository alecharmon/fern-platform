import { oc } from "@orpc/contract";
import * as z from "zod";

// Branded FilePath type matching DocsV1Write.FilePath
export type FilePath = string & { docs_v1_write_FilePath: void };
export const FilePathSchema: z.ZodType<FilePath> = z.string() as any;
export function FilePath(value: string): FilePath {
    return value as unknown as FilePath;
}

export const FilePathInputSchema = z.union([
    FilePathSchema,
    z.object({ path: FilePathSchema, fileHash: z.string().nullish() })
]);
export type FilePathInput = z.infer<typeof FilePathInputSchema>;

export const ImageFilePathSchema = z.object({
    filePath: FilePathSchema,
    width: z.number(),
    height: z.number(),
    blurDataUrl: z.string().nullish(),
    alt: z.string().nullish(),
    fileHash: z.string().nullish()
});
export type ImageFilePath = z.infer<typeof ImageFilePathSchema>;

export const AuthConfigSchema = z.object({
    type: z.string()
});

export const StartDocsRegisterV2InputSchema = z.object({
    orgId: z.string(),
    domain: z.string(),
    customDomains: z.array(z.string()),
    filepaths: z.array(FilePathInputSchema),
    images: z.array(z.any()).nullish(),
    authConfig: AuthConfigSchema.nullish()
});

export const StartDocsRegisterV2ResponseSchema = z.object({
    docsRegistrationId: z.string(),
    uploadUrls: z.record(z.string(), z.string()),
    skippedFiles: z.array(z.string())
});

export const StartDocsPreviewRegisterInputSchema = z.object({
    orgId: z.string(),
    filepaths: z.array(FilePathInputSchema),
    basePath: z.string().nullish(),
    images: z.array(z.any()).nullish(),
    authConfig: AuthConfigSchema.nullish()
});

export const StartDocsPreviewRegisterResponseSchema = z.object({
    docsRegistrationId: z.string(),
    uploadUrls: z.record(z.string(), z.string()),
    skippedFiles: z.array(z.string()),
    previewUrl: z.string()
});

export const FinishDocsRegisterV2InputSchema = z.object({
    docsRegistrationId: z.string(),
    docsDefinition: z.any(),
    libraryDocs: z.any().nullish(),
    excludeApis: z.boolean().nullish(),
    basepathAware: z.boolean().nullish()
});

export const TransferOwnershipInputSchema = z.object({
    domain: z.string(),
    toOrgId: z.string()
});

export const SetIsArchivedInputSchema = z.object({
    url: z.string(),
    isArchived: z.boolean()
});

export const SetDocsUrlMetadataInputSchema = z.object({
    url: z.string(),
    githubUrl: z.string().nullish()
});

export const AlgoliaDomainInputSchema = z.object({
    domain: z.string()
});

export const ListAlgoliaPreviewWhitelistResponseSchema = z.object({
    domains: z.array(z.string())
});

export const DeleteDocsSiteInputSchema = z.object({
    url: z.string()
});

export const docsV2WriteContract = {
    startDocsRegister: oc
        .route({ method: "POST", path: "/v2/init" })
        .input(StartDocsRegisterV2InputSchema)
        .output(StartDocsRegisterV2ResponseSchema),

    startDocsPreviewRegister: oc
        .route({ method: "POST", path: "/preview/init" })
        .input(StartDocsPreviewRegisterInputSchema)
        .output(StartDocsPreviewRegisterResponseSchema),

    finishDocsRegister: oc
        .route({ method: "POST", path: "/register/{docsRegistrationId}" })
        .input(FinishDocsRegisterV2InputSchema)
        .output(z.void()),

    transferOwnershipOfDomain: oc
        .route({ method: "POST", path: "/transfer-ownership" })
        .input(TransferOwnershipInputSchema)
        .output(z.void()),

    setIsArchived: oc
        .route({ method: "POST", path: "/set-is-archived" })
        .input(SetIsArchivedInputSchema)
        .output(z.void()),

    setDocsUrlMetadata: oc
        .route({ method: "POST", path: "/set-metadata-for-url" })
        .input(SetDocsUrlMetadataInputSchema)
        .output(z.void()),

    addAlgoliaPreviewWhitelistEntry: oc
        .route({ method: "POST", path: "/algolia-preview-whitelist/add" })
        .input(AlgoliaDomainInputSchema)
        .output(z.void()),

    removeAlgoliaPreviewWhitelistEntry: oc
        .route({ method: "POST", path: "/algolia-preview-whitelist/remove" })
        .input(AlgoliaDomainInputSchema)
        .output(z.void()),

    listAlgoliaPreviewWhitelist: oc
        .route({ method: "GET", path: "/algolia-preview-whitelist/list" })
        .output(ListAlgoliaPreviewWhitelistResponseSchema),

    deleteDocsSite: oc.route({ method: "POST", path: "/delete" }).input(DeleteDocsSiteInputSchema).output(z.void())
};

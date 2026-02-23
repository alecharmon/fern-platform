import { oc } from "@orpc/contract";
import * as z from "zod";

export const GetDocsUrlMetadataInputSchema = z.object({
    url: z.string()
});

export const GetDocsUrlMetadataResponseSchema = z.object({
    isPreviewUrl: z.boolean(),
    org: z.string(),
    url: z.string(),
    gitUrl: z.string().nullish(),
    enableAlgoliaOnPreview: z.boolean().nullish()
});

export const GetDocsForUrlInputSchema = z.object({
    url: z.string(),
    excludeApis: z.boolean().optional()
});

export const GetPrivateDocsForUrlInputSchema = z.object({
    url: z.string()
});

export const ListAllDocsUrlsInputSchema = z.object({
    limit: z.number().optional(),
    page: z.number().optional(),
    custom: z.boolean().optional(),
    preview: z.boolean().optional()
});

export const GetDocsConfigByIdInputSchema = z.object({
    docsConfigId: z.string()
});

export const docsV2ReadContract = {
    getDocsUrlMetadata: oc
        .route({ method: "POST", path: "/metadata-for-url" })
        .input(GetDocsUrlMetadataInputSchema)
        .output(GetDocsUrlMetadataResponseSchema),

    getDocsForUrl: oc.route({ method: "POST", path: "/load-with-url" }).input(GetDocsForUrlInputSchema).output(z.any()),

    getPrivateDocsForUrl: oc
        .route({ method: "POST", path: "/private/load-with-url" })
        .input(GetPrivateDocsForUrlInputSchema)
        .output(z.any()),

    listAllDocsUrls: oc.route({ method: "GET", path: "/urls/list" }).input(ListAllDocsUrlsInputSchema).output(z.any()),

    getDocsConfigById: oc
        .route({ method: "GET", path: "/{docsConfigId}" })
        .input(GetDocsConfigByIdInputSchema)
        .output(z.any()),

    prepopulateFdrReadS3Bucket: oc.route({ method: "POST", path: "/prepopulate-s3-bucket" }).output(z.void()),

    ensureDocsInS3: oc.route({ method: "POST", path: "/ensure-docs-in-s3" }).output(z.void()),

    getDocsFields: oc.route({ method: "POST", path: "/load-fields" }).output(z.void())
};

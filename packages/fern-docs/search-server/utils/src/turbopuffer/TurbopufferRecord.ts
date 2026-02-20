import { z } from "zod";

export const TurbopufferRecordSchema = z.object({
    id: z.string(),
    vector: z.array(z.number()).optional(),
    attributes: z.object({
        chunk: z.string(),
        document: z.string(),
        title: z.string(),
        url: z.string(),
        version: z.string().optional(),
        product: z.string().optional(),
        roles: z.array(z.string()).optional(),
        keywords: z.array(z.string()).optional(),
        authed: z.boolean().optional(),
        content_type: z.string().optional(),
        breadcrumbs: z.string().optional(),
        chunk_index: z.number().optional(),
        parent_id: z.string().optional(),
        parent_content_hash: z.string().optional(),
        indexed_at: z.string().optional(),
        basepath: z.string().optional()
    })
});

export type TurbopufferRecord = z.infer<typeof TurbopufferRecordSchema>;
export type TurbopufferAttributes = TurbopufferRecord["attributes"];
export type TurbopufferRecordWithoutVector = Omit<TurbopufferRecord, "vector">;

export const FernTurbopufferAttributeSchema: Record<
    keyof TurbopufferAttributes,
    {
        type: "string" | "uint" | "uuid" | "bool" | "[]string" | "[]uint" | "[]uuid" | "int";
        filterable: boolean;
        bm25: boolean;
    }
> = {
    chunk: {
        type: "string",
        filterable: false,
        bm25: false
    },
    document: {
        type: "string",
        filterable: false,
        bm25: false
    },
    title: {
        type: "string",
        filterable: true,
        bm25: true
    },
    url: {
        type: "string",
        filterable: true,
        bm25: false
    },
    authed: {
        type: "bool",
        filterable: true,
        bm25: false
    },
    version: {
        type: "string",
        filterable: true,
        bm25: false
    },
    product: {
        type: "string",
        filterable: true,
        bm25: false
    },
    roles: {
        type: "[]string",
        filterable: true,
        bm25: false
    },
    keywords: {
        type: "[]string",
        filterable: false,
        bm25: true
    },
    content_type: {
        type: "string",
        filterable: true,
        bm25: false
    },
    breadcrumbs: {
        type: "string",
        filterable: false,
        bm25: true
    },
    chunk_index: {
        type: "int",
        filterable: true,
        bm25: false
    },
    parent_id: {
        type: "string",
        filterable: true,
        bm25: false
    },
    parent_content_hash: {
        type: "string",
        filterable: true,
        bm25: false
    },
    indexed_at: {
        type: "string",
        filterable: true,
        bm25: false
    },
    basepath: {
        type: "string",
        filterable: true,
        bm25: false
    }
};

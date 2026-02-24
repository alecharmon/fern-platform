import { oc } from "@orpc/contract";
import * as z from "zod";
import { DocsDefinitionSchema } from "../../../../client/docs-types/read.js";

export { DocsDefinitionSchema as DocsV1ReadDefinitionSchema };

export const GetDocsForDomainLegacyInputSchema = z.object({
    domain: z.string()
});

export const GetDocsForDomainInputSchema = z.object({
    domain: z.string()
});

export const docsV1ReadContract = {
    getDocsForDomainLegacy: oc
        .route({ method: "GET", path: "/load/{domain}" })
        .input(GetDocsForDomainLegacyInputSchema)
        .output(DocsDefinitionSchema),

    getDocsForDomain: oc
        .route({ method: "POST", path: "/load" })
        .input(GetDocsForDomainInputSchema)
        .output(DocsDefinitionSchema)
};

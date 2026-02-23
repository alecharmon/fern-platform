import { oc } from "@orpc/contract";
import * as z from "zod";

// The server returns DocsV1Read.DocsDefinition which is a complex type.
// We use z.any() for the response since the full schema is very large and
// defined in the generated SDK types.

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
        .output(z.any()),

    getDocsForDomain: oc.route({ method: "POST", path: "/load" }).input(GetDocsForDomainInputSchema).output(z.any())
};

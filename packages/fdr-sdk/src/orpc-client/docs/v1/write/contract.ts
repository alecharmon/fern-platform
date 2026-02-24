import { oc } from "@orpc/contract";
import * as z from "zod";
import type { DocsV1Write } from "../../../../client/index.js";

export const StartDocsRegisterV1InputSchema = z.object({
    orgId: z.string(),
    domain: z.string(),
    filepaths: z.array(z.string())
});

export const StartDocsRegisterV1ResponseSchema = z.object({
    docsRegistrationId: z.string(),
    uploadUrls: z.record(z.string(), z.string()),
    skippedFiles: z.array(z.string())
});

export const FinishDocsRegisterV1InputSchema = z.object({
    docsRegistrationId: z.string(),
    docsDefinition: z.unknown() as z.ZodType<DocsV1Write.DocsDefinition>
});

export const docsV1WriteContract = {
    startDocsRegister: oc
        .route({ method: "POST", path: "/init" })
        .input(StartDocsRegisterV1InputSchema)
        .output(StartDocsRegisterV1ResponseSchema),

    finishDocsRegister: oc
        .route({ method: "POST", path: "/register/{docsRegistrationId}" })
        .input(FinishDocsRegisterV1InputSchema)
        .output(z.void())
};

import { FdrAPI } from "@fern-api/fdr-sdk";
import { os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

const EndpointIdentifierSchema = z.object({
    path: z.string(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]),
    identifierOverride: z.string().optional()
});

const BaseSnippetCreateSchema = z.object({
    endpoint: EndpointIdentifierSchema,
    exampleIdentifier: z.string().optional()
});

const TypeScriptSdkSchema = z.object({ package: z.string(), version: z.string() });
const PythonSdkSchema = z.object({ package: z.string(), version: z.string() });
const GoSdkSchema = z.object({ githubRepo: z.string(), version: z.string() });
const RubySdkSchema = z.object({ gem: z.string(), version: z.string() });
const JavaSdkSchema = z.object({ group: z.string(), artifact: z.string(), version: z.string() });
const CsharpSdkSchema = z.object({ package: z.string(), version: z.string() });

const SdkSnippetsCreateSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("typescript"),
        sdk: TypeScriptSdkSchema,
        snippets: z.array(BaseSnippetCreateSchema.extend({ snippet: z.object({ client: z.string() }) }))
    }),
    z.object({
        type: z.literal("python"),
        sdk: PythonSdkSchema,
        snippets: z.array(
            BaseSnippetCreateSchema.extend({
                snippet: z.object({ async_client: z.string(), sync_client: z.string() })
            })
        )
    }),
    z.object({
        type: z.literal("go"),
        sdk: GoSdkSchema,
        snippets: z.array(BaseSnippetCreateSchema.extend({ snippet: z.object({ client: z.string() }) }))
    }),
    z.object({
        type: z.literal("java"),
        sdk: JavaSdkSchema,
        snippets: z.array(
            BaseSnippetCreateSchema.extend({
                snippet: z.object({ async_client: z.string(), sync_client: z.string() })
            })
        )
    }),
    z.object({
        type: z.literal("ruby"),
        sdk: RubySdkSchema,
        snippets: z.array(BaseSnippetCreateSchema.extend({ snippet: z.object({ client: z.string() }) }))
    }),
    z.object({
        type: z.literal("csharp"),
        sdk: CsharpSdkSchema,
        snippets: z.array(BaseSnippetCreateSchema.extend({ snippet: z.object({ client: z.string() }) }))
    })
]);

export function createSnippetsForSdkRouter(app: FdrApplication) {
    const createSnippetsForSdk = os
        .route({ method: "POST", path: "/create" })
        .input(
            z.object({
                orgId: z.string(),
                apiId: z.string(),
                snippets: SdkSnippetsCreateSchema
            })
        )
        .handler(async ({ input }) => {
            await app.dao.snippets().storeSnippets({
                storeSnippetsInfo: {
                    orgId: FdrAPI.OrgId(input.orgId),
                    apiId: FdrAPI.ApiId(input.apiId),
                    sdk: input.snippets as unknown as FdrAPI.SdkSnippetsCreate
                }
            });
        });

    return { createSnippetsForSdk };
}

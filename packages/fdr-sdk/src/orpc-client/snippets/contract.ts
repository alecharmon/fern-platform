import { oc } from "@orpc/contract";
import * as z from "zod";
import { EndpointIdentifierSchema, SdkRequestSchema, type Snippet, type SnippetsByEndpointMethod } from "../shared.js";

// ── SnippetsFactory contract ────────────────────────────────────────────

const TypeScriptSdkSchema = z.object({ package: z.string(), version: z.string() });
const PythonSdkSchema = z.object({ package: z.string(), version: z.string() });
const GoSdkSchema = z.object({ githubRepo: z.string(), version: z.string() });
const RubySdkSchema = z.object({ gem: z.string(), version: z.string() });
const JavaSdkSchema = z.object({ group: z.string(), artifact: z.string(), version: z.string() });
const CsharpSdkSchema = z.object({ package: z.string(), version: z.string() });

const BaseSnippetCreateSchema = z.object({
    endpoint: EndpointIdentifierSchema,
    exampleIdentifier: z.string().nullish()
});

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

export type SdkSnippetsCreate = z.infer<typeof SdkSnippetsCreateSchema>;

export const snippetsFactoryContract = {
    createSnippetsForSdk: oc.route({ method: "POST", path: "/create" }).input(
        z.object({
            orgId: z.string(),
            apiId: z.string(),
            snippets: SdkSnippetsCreateSchema
        })
    )
};

// ── Snippets contract ───────────────────────────────────────────────────

const ParameterPayloadSchema = z.object({
    name: z.string(),
    value: z.unknown()
});

export const AuthPayloadSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("bearer"), token: z.string() }),
    z.object({ type: z.literal("basic"), username: z.string(), password: z.string() })
]);
export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

export const CustomSnippetPayloadSchema = z.object({
    headers: z.array(ParameterPayloadSchema).nullish(),
    pathParameters: z.array(ParameterPayloadSchema).nullish(),
    queryParameters: z.array(ParameterPayloadSchema).nullish(),
    requestBody: z.unknown().nullish(),
    auth: AuthPayloadSchema.nullish()
});
export type CustomSnippetPayload = z.infer<typeof CustomSnippetPayloadSchema>;

export const snippetsContract = {
    get: oc
        .route({ method: "POST", path: "/" })
        .input(
            z.object({
                orgId: z.string().nullish(),
                apiId: z.string().nullish(),
                sdks: z.array(SdkRequestSchema).nullish(),
                endpoint: EndpointIdentifierSchema,
                exampleIdentifier: z.string().nullish(),
                payload: CustomSnippetPayloadSchema.nullish()
            })
        )
        .output(z.array(z.unknown()) as z.ZodType<Snippet[]>),

    load: oc
        .route({ method: "POST", path: "/load" })
        .input(
            z.object({
                orgId: z.string().nullish(),
                apiId: z.string().nullish(),
                sdks: z.array(SdkRequestSchema).nullish()
            })
        )
        .output(
            z.object({
                next: z.number().nullish(),
                snippets: z.record(z.string(), z.unknown()) as z.ZodType<Record<string, SnippetsByEndpointMethod>>
            })
        )
};

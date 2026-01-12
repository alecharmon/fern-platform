import type { AuthEdgeConfig } from "@fern-api/docs-auth";
import type { EdgeFlags, FernColorTheme, HttpMethod } from "@fern-api/docs-utils";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { FernLayoutConfig } from "@fern-api/docs-utils/types/layout-config";
import type { FernSettingsConfig } from "@fern-api/docs-utils/types/settings-config";
import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { ApiDefinition, DocsV1Read, FernNavigation } from "@fern-api/fdr-sdk";
import type {
    AuthScheme,
    EndpointId,
    ObjectProperty,
    PruningNodeType,
    TypeDefinition,
    TypeId
} from "@fern-api/fdr-sdk/api-definition";
import type { Slug } from "@fern-api/fdr-sdk/navigation";
import { z } from "zod";

import type { AuthState } from "./auth/getAuthState";
import type { FernFonts } from "./generateFonts";
import type { DynamicIRsByLanguage } from "./loadDynamicIRFromS3";

/**
 * Conditionally wraps type T in Promise based on IsAsync flag.
 * Allows DocsLoader implementations to be either async by default (network calls) or sync (prefetched data).
 */
type MaybePromise<T, IsAsync extends boolean> = IsAsync extends true ? Promise<T> : T;

export const DocsMetadataSchema = z.object({
    domain: z.string(),
    basePath: z.string(),
    url: z.string(),
    org: z.string(),
    isPreview: z.boolean()
});

export type DocsMetadata = z.infer<typeof DocsMetadataSchema>;

export interface DocsLoader<IsAsync extends boolean = true> {
    getAuthConfig: () => MaybePromise<AuthEdgeConfig | undefined, IsAsync>;
    getAuthConfigs: () => MaybePromise<AuthEdgeConfig[], IsAsync>;
    getMetadata: () => MaybePromise<DocsMetadata, IsAsync>;
}

export interface DocsLoader<IsAsync extends boolean = true> {
    domain: string;
    fern_token: string | undefined;

    getAuthConfig: () => MaybePromise<AuthEdgeConfig | undefined, IsAsync>;
    getAuthConfigs: () => MaybePromise<AuthEdgeConfig[], IsAsync>;

    /**
     * @returns the metadata for the given url, including the domain, base path, url, org, and isPreview
     */
    getMetadata: () => MaybePromise<DocsMetadata, IsAsync>;

    /**
     * @returns a map of file names to their contents
     */
    getFiles: () => MaybePromise<Record<string, FileData>, IsAsync>;

    /**
     * @returns a map of mdx bundler files
     */
    getMdxBundlerFiles: () => MaybePromise<Record<string, string>, IsAsync>;

    /**
     * @returns the api definition for the given id, pruned to the given nodes
     */
    getPrunedApi: (id: string, ...nodes: PruningNodeType[]) => MaybePromise<ApiDefinition.ApiDefinition, IsAsync>;

    /**
     * @returns the endpoint definition for the given api definition id and endpoint id
     */
    getEndpointById: (
        apiDefinitionId: string,
        endpointId: EndpointId
    ) => MaybePromise<
        {
            endpoint: ApiDefinition.EndpointDefinition;
            nodes: FernNavigation.EndpointNode[];
            globalHeaders: ObjectProperty[];
            authSchemes: AuthScheme[];
            types: Record<TypeId, TypeDefinition>;
        },
        IsAsync
    >;

    /**
     * @returns the endpoint definition for the given endpoint locator
     */
    getEndpointByLocator: (
        method: HttpMethod,
        path: string,
        /**
         * multiple endpoints can have the same method + path
         * the example can be used to disambiguate between them
         */
        example?: string
    ) => MaybePromise<
        {
            apiDefinitionId: ApiDefinition.ApiDefinitionId;
            endpoint: ApiDefinition.EndpointDefinition;
            slugs: Slug[];
        },
        IsAsync
    >;

    /**
     * @returns the webhook definition for the given webhook locator (ID or path), or undefined if not found
     */
    getWebhookByLocator: (webhookId: string) => MaybePromise<
        | {
              apiDefinitionId: ApiDefinition.ApiDefinitionId;
              webhook: ApiDefinition.WebhookDefinition;
              slug: Slug | undefined;
          }
        | undefined,
        IsAsync
    >;

    /**
     * @returns the root node of the docs (aware of authentication)
     */
    getRoot: () => MaybePromise<FernNavigation.RootNode, IsAsync>;

    /**
     * @returns the navigation node for the given id
     */
    getNavigationNode: (id: string) => MaybePromise<FernNavigation.NavigationNode, IsAsync>;

    /**
     * DO NOT USE THIS UNLESS YOU KNOW WHAT YOU ARE DOING.
     * This should never be exposed to the client, and should only be used for revalidation.
     * @returns the full root node of the docs (ignoring authentication)
     */
    unsafe_getFullRoot: () => MaybePromise<FernNavigation.RootNode, IsAsync>;

    /**
     * @returns the config of the docs
     */
    getConfig: () => MaybePromise<Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">, IsAsync>;

    /**
     * @returns the markdown content for the given page id
     */
    getPage: (pageId: string) => MaybePromise<
        {
            filename: string;
            markdown: string;
            editThisPageUrl?: string;
            rawMarkdown?: string;
        },
        IsAsync
    >;

    getColors: () => MaybePromise<
        {
            light?: FernColorTheme;
            dark?: FernColorTheme;
        },
        IsAsync
    >;

    getLogoUrls: () => MaybePromise<
        {
            light?: FileData;
            dark?: FileData;
        },
        IsAsync
    >;

    getFonts: () => MaybePromise<FernFonts, IsAsync>;

    getLayout: () => MaybePromise<FernLayoutConfig, IsAsync>;

    getSettings: () => MaybePromise<FernSettingsConfig, IsAsync>;

    getTheme: () => MaybePromise<FernThemeConfig, IsAsync>;

    getLanguage: () => MaybePromise<string, IsAsync>;

    getAuthState: (pathname?: string) => MaybePromise<AuthState, IsAsync>;

    getEdgeFlags: () => MaybePromise<EdgeFlags, IsAsync>;

    getBaseUrl: () => MaybePromise<string, IsAsync>;

    getDynamicIr: (apiName: string) => MaybePromise<DynamicIRsByLanguage | undefined, IsAsync>;

    /**
     * @returns all types defined by all APIs (not pruned)
     */
    getTypes: (apiName?: string) => MaybePromise<Record<TypeId, TypeDefinition>, IsAsync>;
}

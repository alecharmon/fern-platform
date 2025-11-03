import type { AuthEdgeConfig } from "@fern-api/docs-auth";
import type { AuthState } from "@fern-api/docs-server/auth/getAuthState";
import type { DocsLoader, DocsMetadata } from "@fern-api/docs-server/docs-loader";
import type { FernFonts } from "@fern-api/docs-server/generateFonts";
import type { DynamicIRsByLanguage } from "@fern-api/docs-server/loadDynamicIRFromS3";
import type { EdgeFlags, FernColorTheme, HttpMethod } from "@fern-api/docs-utils";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { FernLayoutConfig } from "@fern-api/docs-utils/types/layout-config";
import type { FernSettingsConfig } from "@fern-api/docs-utils/types/settings-config";
import type { ApiDefinition, DocsV1Read } from "@fern-api/fdr-sdk";
import type {
    AuthScheme,
    EndpointId,
    ObjectProperty,
    PruningNodeType,
    TypeDefinition,
    TypeId
} from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { Slug } from "@fern-api/fdr-sdk/navigation";

/**
 * Serializable data structure for transmission over the wire to the client.
 * ⚠️ NEVER add sensitive information e.g. secrets, tokens, etc. to this interface.
 */
export interface DangerousTransmittableDocsLoaderData {
    domain: string;
    config: Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">;
    authState: AuthState;
    edgeFlags: EdgeFlags;
    layout: FernLayoutConfig;
    files?: Record<string, FileData>;
}

/**
 * PrefetchedDocsLoader implements the DocsLoader interface using pre-fetched data
 * instead of making server calls. This allows it to be used in Client Components
 * with data that was already fetched on the server side.
 */
export class PrefetchedDocsLoader implements DocsLoader<false> {
    domain: string;

    private config: Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">;
    private authState: AuthState;
    private edgeFlags: EdgeFlags;
    private layout: FernLayoutConfig;
    private files?: Record<string, FileData>;

    constructor({ config, domain, authState, edgeFlags, layout, files }: DangerousTransmittableDocsLoaderData) {
        this.config = config;
        this.domain = domain;
        this.authState = authState;
        this.edgeFlags = edgeFlags;
        this.layout = layout;
        this.files = files;
    }

    // fern_token should never be available from the client-side loader, so we throw an error if it's accessed
    get fern_token(): never {
        return this.notAllowed("get fern_token");
    }

    /**
     * Converts the PrefetchedDocsLoader data to a plain object safe for client transmission.
     */
    serializable(): DangerousTransmittableDocsLoaderData {
        return {
            config: this.config,
            domain: this.domain,
            authState: this.authState,
            edgeFlags: this.edgeFlags,
            layout: this.layout,
            files: this.files
        };
    }

    static fromSerializable(data: DangerousTransmittableDocsLoaderData): PrefetchedDocsLoader {
        return new PrefetchedDocsLoader(data);
    }

    getAuthState(_pathname?: string): AuthState {
        return this.authState;
    }

    getConfig(): Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root"> {
        return this.config;
    }

    getEdgeFlags(): EdgeFlags {
        return this.edgeFlags;
    }

    getLayout(): FernLayoutConfig {
        return this.layout;
    }

    getAuthConfig(): AuthEdgeConfig | undefined {
        return this.notSupported("getAuthConfig");
    }

    getMetadata(): DocsMetadata {
        return this.notSupported("getMetadata");
    }

    getFiles(): Record<string, FileData> {
        return this.files ?? {};
    }

    getMdxBundlerFiles(): Record<string, string> {
        return this.notSupported("getMdxBundlerFiles");
    }

    getPrunedApi(_id: string, ..._nodes: PruningNodeType[]): ApiDefinition.ApiDefinition {
        return this.notSupported("getPrunedApi");
    }

    getEndpointById(
        _apiDefinitionId: string,
        _endpointId: EndpointId
    ): {
        endpoint: ApiDefinition.EndpointDefinition;
        nodes: FernNavigation.EndpointNode[];
        globalHeaders: ObjectProperty[];
        authSchemes: AuthScheme[];
        types: Record<TypeId, TypeDefinition>;
    } {
        return this.notSupported("getEndpointById");
    }

    getEndpointByLocator(
        _method: HttpMethod,
        _path: string,
        _example?: string
    ): {
        apiDefinitionId: ApiDefinition.ApiDefinitionId;
        endpoint: ApiDefinition.EndpointDefinition;
        slugs: Slug[];
    } {
        return this.notSupported("getEndpointByLocator");
    }

    getRoot(): FernNavigation.RootNode {
        return this.notSupported("getRoot");
    }

    getNavigationNode(_id: string): FernNavigation.NavigationNode {
        return this.notSupported("getNavigationNode");
    }

    unsafe_getFullRoot(): FernNavigation.RootNode {
        return this.notSupported("unsafe_getFullRoot");
    }

    getPage(_pageId: string): {
        filename: string;
        markdown: string;
        editThisPageUrl?: string;
        rawMarkdown?: string;
    } {
        return this.notSupported("getPage");
    }

    getColors(): {
        light?: FernColorTheme;
        dark?: FernColorTheme;
    } {
        return this.notSupported("getColors");
    }

    getLogoUrls(): {
        light?: FileData;
        dark?: FileData;
    } {
        return this.notSupported("getLogoUrls");
    }

    getFonts(): FernFonts {
        return this.notSupported("getFonts");
    }

    getBaseUrl(): string {
        return this.notSupported("getBaseUrl");
    }

    getDynamicIr(_apiName: string): DynamicIRsByLanguage | undefined {
        return this.notSupported("getDynamicIr");
    }

    getSettings(): FernSettingsConfig {
        return this.notSupported("getSettings");
    }

    getTypes(): Record<TypeId, TypeDefinition> {
        return this.notSupported("getTypes");
    }

    private notAllowed(methodName: string): never {
        throw new Error(`${methodName} not allowed in client-side loader`);
    }

    private notSupported(methodName: string): never {
        throw new Error(`${methodName} not supported in client-side loader`);
    }
}

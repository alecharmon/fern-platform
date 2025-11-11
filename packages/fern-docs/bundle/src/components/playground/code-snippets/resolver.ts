import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { unknownToString } from "@fern-api/ui-core-utils";

import type { PlaygroundAuthState, PlaygroundEndpointRequestFormState } from "../types";
import { buildAuthHeaders } from "../utils";
import { shouldRenderAuth } from "../utils/should-render-auth";
import { CurlSnippetBuilder } from "./builders/curl";
import { PythonRequestSnippetBuilder } from "./builders/python";
import { TypescriptFetchSnippetBuilder } from "./builders/typescript";

export class PlaygroundCodeSnippetResolverBuilder {
    constructor(
        private context: EndpointContext,
        private isSnippetTemplatesEnabled: boolean
    ) {}

    public create(
        authState: PlaygroundAuthState,
        formState: PlaygroundEndpointRequestFormState,
        playgroundEnvironment: string | undefined,
        setOAuthValue: (value: (prev: any) => any) => void,
        selectedAuth?: APIV1Read.ApiAuth,
        authKey?: string,
        selectedAuthSchemes?: APIV1Read.ApiAuth[],
        selectedAuthKeys?: string[]
    ): PlaygroundCodeSnippetResolver {
        return new PlaygroundCodeSnippetResolver(
            this.context,
            authState,
            formState,
            false,
            this.isSnippetTemplatesEnabled,
            playgroundEnvironment,
            setOAuthValue,
            selectedAuth,
            authKey,
            selectedAuthSchemes,
            selectedAuthKeys
        );
    }

    public createRedacted(
        authState: PlaygroundAuthState,
        formState: PlaygroundEndpointRequestFormState,
        playgroundEnvironment: string | undefined,
        setOAuthValue: (value: (prev: any) => any) => void,
        selectedAuth?: APIV1Read.ApiAuth,
        authKey?: string,
        selectedAuthSchemes?: APIV1Read.ApiAuth[],
        selectedAuthKeys?: string[]
    ): PlaygroundCodeSnippetResolver {
        return new PlaygroundCodeSnippetResolver(
            this.context,
            authState,
            formState,
            true,
            this.isSnippetTemplatesEnabled,
            playgroundEnvironment,
            setOAuthValue,
            selectedAuth,
            authKey,
            selectedAuthSchemes,
            selectedAuthKeys
        );
    }
}

export class PlaygroundCodeSnippetResolver {
    // TODO: use Headers class for case-insensitive keyes
    private headers: Record<string, unknown> = {};

    public resolve(lang: string, apiDefinition?: APIV1Read.ApiDefinition): string {
        if (lang === "curl") {
            return this.toCurl();
        } else if (lang === "typescript" || lang === "javascript") {
            return this.toTypescriptSdkSnippet(apiDefinition) ?? this.toTypescriptFetch();
        } else if (lang === "python") {
            return this.toPythonSdkSnippet(apiDefinition) ?? this.toPythonRequests();
        } else {
            return "";
        }
    }

    constructor(
        public context: EndpointContext,
        private authState: PlaygroundAuthState,
        private formState: PlaygroundEndpointRequestFormState,
        private isAuthHeadersRedacted: boolean,
        public isSnippetTemplatesEnabled: boolean,
        private baseUrl: string | undefined,
        setOAuthValue: (value: (prev: any) => any) => void,
        selectedAuth?: APIV1Read.ApiAuth,
        authKey?: string,
        selectedAuthSchemes?: APIV1Read.ApiAuth[],
        selectedAuthKeys?: string[]
    ) {
        const authSchemes =
            selectedAuthSchemes && selectedAuthSchemes.length > 0
                ? selectedAuthSchemes
                : selectedAuth
                  ? [selectedAuth]
                  : this.context.auths.length > 0
                    ? [this.context.auths[0]]
                    : [];

        this.selectedAuthSchemes = authSchemes;

        const authKeys =
            selectedAuthKeys && selectedAuthKeys.length > 0
                ? selectedAuthKeys
                : authKey
                  ? [authKey]
                  : authSchemes.map(() => undefined);

        let authHeaders: Record<string, string> = {};

        for (let i = 0; i < authSchemes.length; i++) {
            const auth = authSchemes[i];
            const key = authKeys[i];
            if (auth != null && shouldRenderAuth(this.context.endpoint, auth)) {
                const headers = buildAuthHeaders(
                    auth,
                    authState,
                    { redacted: isAuthHeadersRedacted },
                    {
                        formState,
                        endpoint: this.context.endpoint,
                        baseUrl: this.baseUrl,
                        setValue: setOAuthValue
                    },
                    key
                );
                authHeaders = { ...authHeaders, ...headers };
            }
        }

        this.headers = { ...authHeaders, ...formState.headers };

        if (this.context.endpoint.method !== "GET" && this.context.endpoint.requests?.[0]?.contentType != null) {
            this.headers["Content-Type"] = this.context.endpoint.requests[0].contentType;
        }
    }

    private selectedAuthSchemes: APIV1Read.ApiAuth[];

    public toCurl(): string {
        const formState = { ...this.formState, headers: this.headers };
        return new CurlSnippetBuilder(
            this.context,
            formState,
            this.authState,
            this.baseUrl,
            this.isAuthHeadersRedacted,
            this.selectedAuthSchemes
        ).build();
    }

    public toTypescriptFetch(): string {
        const headers = { ...this.headers };

        // TODO: ensure case insensitivity
        if (unknownToString(headers["Content-Type"]).includes("multipart/form-data")) {
            delete headers["Content-Type"]; // fetch will set this automatically
        }

        const formState = { ...this.formState, headers };
        return new TypescriptFetchSnippetBuilder(
            this.context,
            formState,
            this.authState,
            this.baseUrl,
            this.isAuthHeadersRedacted,
            this.selectedAuthSchemes
        ).build();
    }

    public toPythonRequests(): string {
        const formState = { ...this.formState, headers: this.headers };
        return new PythonRequestSnippetBuilder(
            this.context,
            formState,
            this.authState,
            this.baseUrl,
            this.isAuthHeadersRedacted,
            this.selectedAuthSchemes
        ).build();
    }

    public toTypescriptSdkSnippet(_apiDefinition?: APIV1Read.ApiDefinition): string | undefined {
        return undefined;
    }

    public toPythonSdkSnippet(_apiDefinition?: APIV1Read.ApiDefinition): string | undefined {
        return undefined;
    }
}

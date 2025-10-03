import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { type APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { unknownToString } from "@fern-api/ui-core-utils";

import { PlaygroundAuthState, PlaygroundEndpointRequestFormState } from "../types";
import { buildAuthHeaders } from "../utils";
import { shouldRenderAuth } from "../utils/should-render-auth";
import { CurlSnippetBuilder } from "./builders/curl";
import { PythonRequestSnippetBuilder } from "./builders/python";
import { TypescriptFetchSnippetBuilder } from "./builders/typescript";

export class PlaygroundCodeSnippetResolverBuilder {
    constructor(
        private context: EndpointContext,
        private isSnippetTemplatesEnabled: boolean,
        private isFileForgeHackEnabled: boolean
    ) {}

    public create(
        authState: PlaygroundAuthState,
        formState: PlaygroundEndpointRequestFormState,
        playgroundEnvironment: string | undefined,
        setOAuthValue: (value: (prev: any) => any) => void
    ): PlaygroundCodeSnippetResolver {
        return new PlaygroundCodeSnippetResolver(
            this.context,
            authState,
            formState,
            false,
            this.isSnippetTemplatesEnabled,
            this.isFileForgeHackEnabled,
            playgroundEnvironment,
            setOAuthValue
        );
    }

    public createRedacted(
        authState: PlaygroundAuthState,
        formState: PlaygroundEndpointRequestFormState,
        playgroundEnvironment: string | undefined,
        setOAuthValue: (value: (prev: any) => any) => void
    ): PlaygroundCodeSnippetResolver {
        return new PlaygroundCodeSnippetResolver(
            this.context,
            authState,
            formState,
            true,
            this.isSnippetTemplatesEnabled,
            this.isFileForgeHackEnabled,
            playgroundEnvironment,
            setOAuthValue
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
        private isFileForgeHackEnabled: boolean,
        private baseUrl: string | undefined,
        setOAuthValue: (value: (prev: any) => any) => void
    ) {
        const authHeaders = buildAuthHeaders(
            this.context.auth != null && shouldRenderAuth(this.context.endpoint, this.context.auth)
                ? this.context.auth
                : undefined,
            authState,
            { redacted: isAuthHeadersRedacted },
            {
                formState,
                endpoint: this.context.endpoint,
                baseUrl: this.baseUrl,
                setValue: setOAuthValue
            }
        );

        this.headers = { ...authHeaders, ...formState.headers };

        if (this.context.endpoint.method !== "GET" && this.context.endpoint.requests?.[0]?.contentType != null) {
            this.headers["Content-Type"] = this.context.endpoint.requests[0].contentType;
        }
    }

    public toCurl(): string {
        const formState = { ...this.formState, headers: this.headers };
        return new CurlSnippetBuilder(this.context, formState, this.authState, this.baseUrl, this.isAuthHeadersRedacted)
            .setFileForgeHackEnabled(this.isFileForgeHackEnabled)
            .build();
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
            this.isAuthHeadersRedacted
        ).build();
    }

    public toPythonRequests(): string {
        const formState = { ...this.formState, headers: this.headers };
        return new PythonRequestSnippetBuilder(
            this.context,
            formState,
            this.authState,
            this.baseUrl,
            this.isAuthHeadersRedacted
        ).build();
    }

    public toTypescriptSdkSnippet(_apiDefinition?: APIV1Read.ApiDefinition): string | undefined {
        return undefined;
    }

    public toPythonSdkSnippet(_apiDefinition?: APIV1Read.ApiDefinition): string | undefined {
        return undefined;
    }
}

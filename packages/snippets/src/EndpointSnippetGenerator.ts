import type { dynamic } from "@fern-api/dynamic-ir-sdk/api";
import type { AbstractDynamicSnippetsGenerator } from "./core/AbstractDynamicSnippetsGenerator";
import type { Request } from "./Request";

export class EndpointSnippetGenerator {
    private generator: AbstractDynamicSnippetsGenerator;
    private endpoint: dynamic.Endpoint;

    constructor({
        generator,
        endpoint
    }: {
        generator: AbstractDynamicSnippetsGenerator;
        endpoint: dynamic.Endpoint;
    }) {
        this.generator = generator;
        this.endpoint = endpoint;
    }

    public async generate(request?: Request): Promise<dynamic.EndpointSnippetResponse> {
        const _request = request ?? this.resolveDefaultRequestOrThrow();
        return this.generator.generate({
            endpoint: this.endpoint.location,
            baseURL: _request.baseURL,
            environment: _request.environment,
            auth: _request.auth,
            pathParameters: _request.pathParameters,
            queryParameters: _request.queryParameters,
            headers: _request.headers,
            requestBody: _request.requestBody
        });
    }

    public generateSync(request?: Request): dynamic.EndpointSnippetResponse {
        const _request = request ?? this.resolveDefaultRequestOrThrow();
        return this.generator.generateSync({
            endpoint: this.endpoint.location,
            baseURL: _request.baseURL,
            environment: _request.environment,
            auth: _request.auth,
            pathParameters: _request.pathParameters,
            queryParameters: _request.queryParameters,
            headers: _request.headers,
            requestBody: _request.requestBody
        });
    }

    private resolveDefaultRequestOrThrow(): Request {
        for (const example of this.endpoint.examples ?? []) {
            return {
                ...example,
                environment: undefined
            };
        }
        throw new Error(`No default example found for endpoint; please specify a request payload`);
    }
}

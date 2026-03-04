import { DynamicSnippetsGenerator as CSharp } from "@fern-api/csharp-dynamic-snippets";
import type { FernIr } from "@fern-api/dynamic-ir-sdk";
import { DynamicSnippetsGenerator as Go } from "@fern-api/go-dynamic-snippets";
import { DynamicSnippetsGenerator as Java } from "@fern-api/java-dynamic-snippets";
import { DynamicSnippetsGenerator as PHP } from "@fern-api/php-dynamic-snippets";
import { DynamicSnippetsGenerator as Python } from "@fern-api/python-dynamic-snippets";
import { DynamicSnippetsGenerator as Ruby } from "@fern-api/ruby-dynamic-snippets";
import { DynamicSnippetsGenerator as Swift } from "@fern-api/swift-dynamic-snippets";
import { DynamicSnippetsGenerator as TypeScript } from "@fern-api/typescript-dynamic-snippets";
import type { AbstractDynamicSnippetsGenerator } from "./core/AbstractDynamicSnippetsGenerator";
import { HttpEndpointReferenceParser } from "./core/HttpEndpointReferenceParser";
import { EndpointSnippetGenerator } from "./EndpointSnippetGenerator";
import type { Language } from "./Language";
import type { Options } from "./Options";

export class EndpointProvider {
    private config: FernIr.generatorExec.config.GeneratorConfig;
    private language: Language;
    private ir: FernIr.dynamic.DynamicIntermediateRepresentation;
    private httpEndpointReferenceParser: HttpEndpointReferenceParser;

    constructor({
        config,
        language,
        ir
    }: {
        config: FernIr.generatorExec.config.GeneratorConfig;
        language: Language;
        ir: FernIr.dynamic.DynamicIntermediateRepresentation;
    }) {
        this.config = config;
        this.language = language;
        this.ir = ir;
        this.httpEndpointReferenceParser = new HttpEndpointReferenceParser();
    }

    public endpoint(endpoint: string, _options: Options = {}): EndpointSnippetGenerator {
        const parsedEndpoint = this.parseEndpointOrThrow({ endpoint });
        const generator = this.getGenerator({ ir: this.ir });
        const resolvedEndpoint = this.resolveEndpointOrThrow({
            ir: this.ir,
            parsedEndpoint
        });
        return new EndpointSnippetGenerator({
            generator,
            endpoint: resolvedEndpoint
        });
    }

    private getGenerator({
        ir
    }: {
        ir: FernIr.dynamic.DynamicIntermediateRepresentation;
    }): AbstractDynamicSnippetsGenerator {
        switch (this.language) {
            case "python": {
                return new Python({ ir, config: this.config });
            }
            case "typescript": {
                return new TypeScript({ ir, config: this.config });
            }
            case "java": {
                return new Java({ ir, config: this.config });
            }
            case "php": {
                return new PHP({ ir, config: this.config });
            }
            case "ruby": {
                return new Ruby({ ir, config: this.config });
            }
            case "csharp": {
                return new CSharp({ ir, config: this.config });
            }
            case "go": {
                return new Go({ ir, config: this.config });
            }
            case "swift": {
                return new Swift({ ir, config: this.config });
            }
            default:
                throw new Error(`Unsupported language: ${this.language}`);
        }
    }

    private parseEndpointOrThrow({ endpoint }: { endpoint: string }): FernIr.dynamic.EndpointLocation {
        const parsedEndpoint = this.httpEndpointReferenceParser.tryParse(endpoint);
        if (parsedEndpoint == null) {
            throw new Error(`Invalid endpoint reference: "${endpoint}"`);
        }
        return parsedEndpoint;
    }

    private resolveEndpointOrThrow({
        ir,
        parsedEndpoint
    }: {
        ir: FernIr.dynamic.DynamicIntermediateRepresentation;
        parsedEndpoint: FernIr.dynamic.EndpointLocation;
    }): FernIr.dynamic.Endpoint {
        for (const endpoint of Object.values(ir.endpoints)) {
            if (this.parsedEndpointMatches({ endpoint, parsedEndpoint })) {
                return endpoint;
            }
        }
        throw new Error(`Failed to find endpoint identified by "${parsedEndpoint.method} ${parsedEndpoint.path}"`);
    }

    private parsedEndpointMatches({
        endpoint,
        parsedEndpoint
    }: {
        endpoint: FernIr.dynamic.Endpoint;
        parsedEndpoint: FernIr.dynamic.EndpointLocation;
    }): boolean {
        return endpoint.location.method === parsedEndpoint.method && endpoint.location.path === parsedEndpoint.path;
    }
}

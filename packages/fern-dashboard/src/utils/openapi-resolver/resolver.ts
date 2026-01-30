/**
 * OpenAPI Location Resolver
 *
 * Core resolver logic for mapping FDR identifiers to OpenAPI spec locations.
 * Handles override priority, $ref resolution, and various description targets.
 */

import * as yaml from "js-yaml";
import type { RefResolutionContext } from "./ref-utils";
import { resolveJsonPath, resolvePropertyPath, resolveRef } from "./ref-utils";
import type {
    DescriptionTarget,
    OpenApiResolverResult,
    OpenApiWriteResult,
    OperationIndex,
    ParameterDescriptionTarget,
    ParameterObject,
    ParsedOpenApiSpec,
    SchemaObject
} from "./types";
import { isReferenceObject } from "./types";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

/** Resolves FDR description targets to their locations in OpenAPI spec files. */
export class OpenApiResolver {
    private parsedSpecs: Map<string, ParsedOpenApiSpec> = new Map();
    private operationIndex: OperationIndex = {
        byOperationId: new Map(),
        byPathMethod: new Map()
    };
    private overrideFiles: Set<string> = new Set();

    /**
     * Create a resolver from raw spec file contents.
     *
     * @param specs Map of file path to raw file content (YAML or JSON string)
     * @param overrideFilePaths Set of file paths that are override files (for priority)
     */
    constructor(specs: Map<string, string>, overrideFilePaths?: Set<string>) {
        this.overrideFiles = overrideFilePaths ?? new Set();
        this.parseSpecs(specs);
        this.buildOperationIndex();
    }

    /** Parse all spec files into structured objects. */
    private parseSpecs(specs: Map<string, string>): void {
        for (const [filePath, content] of specs) {
            try {
                // yaml.load handles both YAML and JSON formats
                const parsed = yaml.load(content) as ParsedOpenApiSpec;
                if (parsed && typeof parsed === "object") {
                    this.parsedSpecs.set(filePath, parsed);
                }
            } catch {
                console.warn(`Failed to parse OpenAPI spec: ${filePath}`);
            }
        }
    }

    /** Build index for quick operation lookups. */
    private buildOperationIndex(): void {
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            if (!spec?.paths) {
                continue;
            }

            for (const [path, pathItem] of Object.entries(spec.paths)) {
                for (const method of HTTP_METHODS) {
                    const operation = pathItem?.[method];
                    if (!operation) {
                        continue;
                    }

                    const key = `${method.toUpperCase()} ${path}`;

                    // Only add if not already indexed (override priority)
                    if (!this.operationIndex.byPathMethod.has(key)) {
                        this.operationIndex.byPathMethod.set(key, operation.operationId);
                    }

                    if (operation.operationId && !this.operationIndex.byOperationId.has(operation.operationId)) {
                        this.operationIndex.byOperationId.set(operation.operationId, { path, method });
                    }
                }
            }
        }
    }

    /** Resolve a description target to its OpenAPI location. */
    resolve(target: DescriptionTarget): OpenApiResolverResult {
        switch (target.type) {
            case "endpoint":
                return this.resolveEndpoint(target);
            case "schema":
                return this.resolveSchema(target);
            case "property":
                return this.resolveProperty(target);
            case "parameter":
                return this.resolveParameter(target);
            case "requestBody":
                return this.resolveRequestBody(target);
            case "requestBodyProperty":
                return this.resolveRequestBodyProperty(target);
            case "response":
                return this.resolveResponse(target);
            case "responseProperty":
                return this.resolveResponseProperty(target);
            case "enumValue":
                return this.resolveEnumValue(target);
            case "formDataField":
                return this.resolveFormDataField(target);
            default:
                return { location: null, reason: "not-found" };
        }
    }

    /** Resolve endpoint description. Path: paths.{path}.{method}.description */
    private resolveEndpoint(target: { operationId?: string; method: string; path: string }): OpenApiResolverResult {
        const location = this.findOperation(target);
        if (!location) {
            return { location: null, reason: "not-found" };
        }

        return {
            location: {
                filePath: location.filePath,
                jsonPath: ["paths", location.path, location.method.toLowerCase(), "description"],
                isInOverride: this.overrideFiles.has(location.filePath)
            }
        };
    }

    /** Resolve schema description. Path: components.schemas.{typeId}.description */
    private resolveSchema(target: { typeId: string }): OpenApiResolverResult {
        // Check override files first
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            if (!spec?.components?.schemas) {
                continue;
            }

            if (target.typeId in spec.components.schemas) {
                const schema = spec.components.schemas[target.typeId];

                // Handle $ref
                if (isReferenceObject(schema)) {
                    const resolved = this.resolveRefToLocation(schema.$ref, filePath);
                    if (resolved) {
                        return {
                            location: {
                                filePath: resolved.filePath,
                                jsonPath: [...resolved.jsonPath, "description"],
                                isInOverride: this.overrideFiles.has(resolved.filePath)
                            }
                        };
                    }
                    return { location: null, reason: "unsupported-ref" };
                }

                // Check for composition types
                const schemaObj = schema as SchemaObject;
                if (schemaObj.allOf || schemaObj.oneOf || schemaObj.anyOf) {
                    return { location: null, reason: "composition-type" };
                }

                return {
                    location: {
                        filePath,
                        jsonPath: ["components", "schemas", target.typeId, "description"],
                        isInOverride: this.overrideFiles.has(filePath)
                    }
                };
            }
        }

        return { location: null, reason: "not-found" };
    }

    /** Resolve property description. Path: components.schemas.{typeId}.properties.{prop}...description */
    private resolveProperty(target: { typeId: string; propertyPath: string[] }): OpenApiResolverResult {
        if (target.propertyPath.length === 0) {
            // Empty path means schema description
            return this.resolveSchema({ typeId: target.typeId });
        }

        // Find the root schema first
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            if (!spec?.components?.schemas) {
                continue;
            }

            if (!(target.typeId in spec.components.schemas)) {
                continue;
            }

            const rootSchema = spec.components.schemas[target.typeId];
            if (!rootSchema) {
                continue;
            }

            // Let resolvePropertyPath handle the $ref resolution - it will set the correct basePath
            const context: RefResolutionContext = {
                specs: this.parsedSpecs,
                currentFile: filePath,
                visited: new Set()
            };

            const result = resolvePropertyPath(rootSchema, target.propertyPath, context);

            if (result) {
                // If the root schema is a $ref, resolvePropertyPath will have set the full path
                // Otherwise, we need to prepend the component schema path
                const jsonPath = isReferenceObject(rootSchema)
                    ? [...result.jsonPath, "description"]
                    : ["components", "schemas", target.typeId, ...result.jsonPath, "description"];

                return {
                    location: {
                        filePath: result.filePath,
                        jsonPath,
                        isInOverride: this.overrideFiles.has(result.filePath)
                    }
                };
            }
        }

        return { location: null, reason: "not-found" };
    }

    /** Resolve parameter description. Path: paths.{path}.{method}.parameters[name={paramName}].description */
    private resolveParameter(target: {
        operationId?: string;
        method: string;
        path: string;
        paramName: string;
        paramIn: string;
    }): OpenApiResolverResult {
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            const pathItem = spec?.paths?.[target.path];
            if (!pathItem) {
                continue;
            }

            const operation = pathItem[target.method.toLowerCase() as HttpMethod];

            // Check operation-level parameters first
            const opResult = this.findParameterInArray(operation?.parameters, target.paramName, target.paramIn);
            if (opResult) {
                return {
                    location: {
                        filePath,
                        jsonPath: [
                            "paths",
                            target.path,
                            target.method.toLowerCase(),
                            "parameters",
                            String(opResult.index),
                            "description"
                        ],
                        isInOverride: this.overrideFiles.has(filePath)
                    }
                };
            }

            // Check path-level parameters
            const pathResult = this.findParameterInArray(pathItem.parameters, target.paramName, target.paramIn);
            if (pathResult) {
                return {
                    location: {
                        filePath,
                        jsonPath: ["paths", target.path, "parameters", String(pathResult.index), "description"],
                        isInOverride: this.overrideFiles.has(filePath)
                    }
                };
            }
        }

        return { location: null, reason: "not-found" };
    }

    /** Resolve request body description. Path: paths.{path}.{method}.requestBody.description */
    private resolveRequestBody(target: { operationId?: string; method: string; path: string }): OpenApiResolverResult {
        // Try to find the requestBody in any spec file (override or main)
        // This handles the case where an override only has partial operation data
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            const operation = spec?.paths?.[target.path]?.[target.method.toLowerCase() as HttpMethod];

            if (!operation?.requestBody) {
                continue;
            }

            // Handle $ref
            if (isReferenceObject(operation.requestBody)) {
                const resolved = this.resolveRefToLocation(operation.requestBody.$ref, filePath);
                if (resolved) {
                    return {
                        location: {
                            filePath: resolved.filePath,
                            jsonPath: [...resolved.jsonPath, "description"],
                            isInOverride: this.overrideFiles.has(resolved.filePath)
                        }
                    };
                }
                return { location: null, reason: "unsupported-ref" };
            }

            return {
                location: {
                    filePath,
                    jsonPath: ["paths", target.path, target.method.toLowerCase(), "requestBody", "description"],
                    isInOverride: this.overrideFiles.has(filePath)
                }
            };
        }

        return { location: null, reason: "not-found" };
    }

    /** Resolve request body property description. */
    private resolveRequestBodyProperty(target: {
        operationId?: string;
        method: string;
        path: string;
        propertyPath: string[];
    }): OpenApiResolverResult {
        if (target.propertyPath.length === 0) {
            return this.resolveRequestBody({
                operationId: target.operationId,
                method: target.method,
                path: target.path
            });
        }

        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            const operation = spec?.paths?.[target.path]?.[target.method.toLowerCase() as HttpMethod];

            if (!operation?.requestBody || isReferenceObject(operation.requestBody)) {
                continue;
            }

            const result = this.resolveContentSchemaProperty(
                operation.requestBody.content,
                target.propertyPath,
                filePath,
                ["application/json", "application/x-www-form-urlencoded", "*/*"],
                ["paths", target.path, target.method.toLowerCase(), "requestBody"]
            );
            if (result) {
                return result;
            }
        }

        return { location: null, reason: "not-found" };
    }

    /** Resolve response description. Path: paths.{path}.{method}.responses.{statusCode}.description */
    private resolveResponse(target: {
        operationId?: string;
        method: string;
        path: string;
        statusCode: number;
    }): OpenApiResolverResult {
        const statusKey = String(target.statusCode);

        // Try to find the response in any spec file (override or main)
        // This handles the case where an override only has partial operation data
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            const operation = spec?.paths?.[target.path]?.[target.method.toLowerCase() as HttpMethod];

            if (!operation?.responses?.[statusKey]) {
                continue;
            }

            const response = operation.responses[statusKey];

            // Handle $ref
            if (isReferenceObject(response)) {
                const resolved = this.resolveRefToLocation(response.$ref, filePath);
                if (resolved) {
                    return {
                        location: {
                            filePath: resolved.filePath,
                            jsonPath: [...resolved.jsonPath, "description"],
                            isInOverride: this.overrideFiles.has(resolved.filePath)
                        }
                    };
                }
                return { location: null, reason: "unsupported-ref" };
            }

            return {
                location: {
                    filePath,
                    jsonPath: [
                        "paths",
                        target.path,
                        target.method.toLowerCase(),
                        "responses",
                        statusKey,
                        "description"
                    ],
                    isInOverride: this.overrideFiles.has(filePath)
                }
            };
        }

        return { location: null, reason: "not-found" };
    }

    /** Resolve response body property description. */
    private resolveResponseProperty(target: {
        operationId?: string;
        method: string;
        path: string;
        statusCode: number;
        propertyPath: string[];
    }): OpenApiResolverResult {
        if (target.propertyPath.length === 0) {
            return this.resolveResponse({
                operationId: target.operationId,
                method: target.method,
                path: target.path,
                statusCode: target.statusCode
            });
        }

        const statusKey = String(target.statusCode);

        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            const operation = spec?.paths?.[target.path]?.[target.method.toLowerCase() as HttpMethod];

            if (!operation?.responses?.[statusKey]) {
                continue;
            }

            const response = operation.responses[statusKey];
            if (isReferenceObject(response)) {
                continue;
            }

            const result = this.resolveContentSchemaProperty(
                response.content,
                target.propertyPath,
                filePath,
                ["application/json", "*/*"],
                ["paths", target.path, target.method.toLowerCase(), "responses", statusKey]
            );
            if (result) {
                return result;
            }
        }

        return { location: null, reason: "not-found" };
    }

    /** Resolve enum value description via x-enum-descriptions extension. */
    private resolveEnumValue(target: { typeId: string; enumValue: string }): OpenApiResolverResult {
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            if (!spec?.components?.schemas) {
                continue;
            }

            if (!(target.typeId in spec.components.schemas)) {
                continue;
            }

            const schema = spec.components.schemas[target.typeId] as SchemaObject & {
                enum?: string[];
                "x-enum-descriptions"?: Record<string, string>;
            };

            // Handle $ref
            if (isReferenceObject(schema)) {
                continue; // Skip refs for now, enum editing is complex with refs
            }

            // Find the enum value index
            if (!schema.enum) {
                continue;
            }

            const enumIndex = schema.enum.indexOf(target.enumValue);
            if (enumIndex === -1) {
                continue;
            }

            // Use x-enum-descriptions extension (common pattern)
            return {
                location: {
                    filePath,
                    jsonPath: ["components", "schemas", target.typeId, "x-enum-descriptions", target.enumValue],
                    isInOverride: this.overrideFiles.has(filePath)
                }
            };
        }

        return { location: null, reason: "not-found" };
    }

    /** Resolve form data field description. */
    private resolveFormDataField(target: {
        operationId?: string;
        method: string;
        path: string;
        fieldKey: string;
        fieldType: string;
    }): OpenApiResolverResult {
        // Try to find the form data field in any spec file (override or main)
        // This handles the case where an override only has partial operation data
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            const operation = spec?.paths?.[target.path]?.[target.method.toLowerCase() as HttpMethod];

            if (!operation?.requestBody || isReferenceObject(operation.requestBody)) {
                continue;
            }

            const formDataContent = operation.requestBody.content?.["multipart/form-data"];
            if (!formDataContent?.schema || isReferenceObject(formDataContent.schema)) {
                continue;
            }

            const schema = formDataContent.schema as SchemaObject;
            if (!schema.properties || !(target.fieldKey in schema.properties)) {
                continue;
            }

            return {
                location: {
                    filePath,
                    jsonPath: [
                        "paths",
                        target.path,
                        target.method.toLowerCase(),
                        "requestBody",
                        "content",
                        "multipart/form-data",
                        "schema",
                        "properties",
                        target.fieldKey,
                        "description"
                    ],
                    isInOverride: this.overrideFiles.has(filePath)
                }
            };
        }

        return { location: null, reason: "not-found" };
    }

    /** Find an operation by operationId or method+path. */
    private findOperation(target: {
        operationId?: string;
        method: string;
        path: string;
    }): { filePath: string; path: string; method: string } | null {
        // Try operationId first
        if (target.operationId) {
            const byOpId = this.operationIndex.byOperationId.get(target.operationId);
            if (byOpId) {
                // Find which file has this operation
                for (const filePath of this.getFilesByPriority()) {
                    const spec = this.parsedSpecs.get(filePath);
                    const operation = spec?.paths?.[byOpId.path]?.[byOpId.method as HttpMethod];
                    if (operation?.operationId === target.operationId) {
                        return { filePath, path: byOpId.path, method: byOpId.method };
                    }
                }
            }
        }

        // Fall back to method + path matching
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            const pathItem = spec?.paths?.[target.path];
            if (pathItem?.[target.method.toLowerCase() as HttpMethod]) {
                return { filePath, path: target.path, method: target.method.toLowerCase() };
            }
        }

        return null;
    }

    /** Get file paths ordered by priority (overrides first). */
    private getFilesByPriority(): string[] {
        return [...this.parsedSpecs.keys()].sort((a, b) => {
            const aIsOverride = this.overrideFiles.has(a);
            const bIsOverride = this.overrideFiles.has(b);
            if (aIsOverride && !bIsOverride) {
                return -1;
            }
            if (!aIsOverride && bIsOverride) {
                return 1;
            }
            return 0;
        });
    }

    /** Find a parameter by name and location in a parameters array. */
    private findParameterInArray(
        params: ParameterObject[] | undefined,
        name: string,
        inType: string
    ): { index: number; param: ParameterObject } | null {
        if (!Array.isArray(params)) {
            return null;
        }
        const index = params.findIndex((p) => p != null && !isReferenceObject(p) && p.name === name && p.in === inType);
        if (index === -1) {
            return null;
        }
        const param = params[index];
        return param && !isReferenceObject(param) ? { index, param } : null;
    }

    /** Resolve a $ref to its location info. */
    private resolveRefToLocation(ref: string, fromFile: string): { filePath: string; jsonPath: string[] } | null {
        const resolved = resolveRef(ref, this.createRefContext(fromFile));
        return resolved ? { filePath: resolved.filePath, jsonPath: resolved.jsonPath } : null;
    }

    /** Create a resolution context for the given file. */
    private createRefContext(currentFile: string): RefResolutionContext {
        return {
            specs: this.parsedSpecs,
            currentFile,
            visited: new Set()
        };
    }

    /** Helper for resolving property paths within content schemas (request/response bodies). */
    private resolveContentSchemaProperty(
        content: Record<string, { schema?: SchemaObject | { $ref: string } }> | undefined,
        propertyPath: string[],
        filePath: string,
        contentTypes: string[],
        operationBasePath: string[]
    ): OpenApiResolverResult | null {
        for (const contentType of contentTypes) {
            const mediaContent = content?.[contentType];
            if (!mediaContent?.schema) {
                continue;
            }

            const schema = mediaContent.schema;
            const schemaAsArray = schema as { type?: string; items?: unknown } | undefined;
            const isCurrentSchemaRef =
                isReferenceObject(schema) ||
                (schemaAsArray?.type === "array" && schemaAsArray.items && isReferenceObject(schemaAsArray.items));

            // Check if main spec uses $ref for this schema location
            const mainSpecRefSchema = this.getMainSpecRefSchema(operationBasePath, contentType);

            // If main spec has $ref, always resolve via that path
            if (mainSpecRefSchema) {
                const mainSpecFile = this.getMainSpecFile();
                if (mainSpecFile) {
                    const result = resolvePropertyPath(
                        mainSpecRefSchema,
                        propertyPath,
                        this.createRefContext(mainSpecFile)
                    );
                    if (result) {
                        const jsonPath = [...result.jsonPath, "description"];
                        const fileWithValue = this.findFileWithPath(jsonPath);
                        const resolvedFilePath = fileWithValue ?? result.filePath;
                        return {
                            location: {
                                filePath: resolvedFilePath,
                                jsonPath,
                                isInOverride: this.overrideFiles.has(resolvedFilePath)
                            }
                        };
                    }
                }
            }

            // Current schema is a $ref
            if (isCurrentSchemaRef) {
                const schemaToResolve = isReferenceObject(schema) ? schema : (schemaAsArray?.items as { $ref: string });

                const result = resolvePropertyPath(schemaToResolve, propertyPath, this.createRefContext(filePath));
                if (result) {
                    const jsonPath = [...result.jsonPath, "description"];
                    const fileWithValue = this.findFileWithPath(jsonPath);
                    const resolvedFilePath = fileWithValue ?? result.filePath;
                    return {
                        location: {
                            filePath: resolvedFilePath,
                            jsonPath,
                            isInOverride: this.overrideFiles.has(resolvedFilePath)
                        }
                    };
                }
            }

            // Inline schema
            const result = resolvePropertyPath(schema, propertyPath, this.createRefContext(filePath));
            if (result) {
                const inlineJsonPath = [
                    ...operationBasePath,
                    "content",
                    contentType,
                    "schema",
                    "properties",
                    ...propertyPath,
                    "description"
                ];
                return {
                    location: {
                        filePath: result.filePath,
                        jsonPath: inlineJsonPath,
                        isInOverride: this.overrideFiles.has(result.filePath),
                        inlineJsonPath: inlineJsonPath
                    }
                };
            }
        }
        return null;
    }

    /** Get the $ref schema from main spec (non-override) at this operation path. Also handles array items. */
    private getMainSpecRefSchema(operationBasePath: string[], contentType: string): { $ref: string } | null {
        for (const [filePath, spec] of this.parsedSpecs.entries()) {
            if (this.overrideFiles.has(filePath)) {
                continue;
            }

            let current: unknown = spec;
            for (const key of operationBasePath) {
                current = (current as Record<string, unknown>)?.[key];
                if (!current) {
                    break;
                }
            }
            const content = (current as { content?: Record<string, { schema?: unknown }> })?.content;
            const schema = content?.[contentType]?.schema;

            // Check if schema itself is a $ref
            if (schema && isReferenceObject(schema)) {
                return schema;
            }

            // Also check array items for $ref (e.g., type: array, items: { $ref: ... })
            const schemaObj = schema as { type?: string; items?: unknown } | undefined;
            if (schemaObj?.type === "array" && schemaObj.items && isReferenceObject(schemaObj.items)) {
                return schemaObj.items;
            }
        }
        return null;
    }

    /** Find the first file (in priority order) that has a value at the given JSON path. */
    private findFileWithPath(jsonPath: string[]): string | null {
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            if (spec && resolveJsonPath(spec, jsonPath) !== undefined) {
                return filePath;
            }
        }
        return null;
    }

    /**
     * Get the description value for a target from the provided specs.
     *
     * This method is useful when you need to read description values from
     * specs that may have been updated since the resolver was created
     * (e.g., after a pending change was applied).
     *
     * @param target The description target to resolve
     * @param rawSpecs The current specs map (raw YAML/JSON strings)
     * @param preferOverrides Whether to check override files first
     * @returns The description value, or undefined if not found
     */
    getDescriptionValue(
        target: DescriptionTarget,
        rawSpecs: Map<string, string>,
        preferOverrides: boolean
    ): string | undefined {
        // Use resolveWriteLocation to check override files first when preferOverrides is true
        const result = this.resolveWriteLocation(target, preferOverrides);
        if (!result.location) {
            return undefined;
        }

        // Get the spec content from the provided specs
        let specContent = rawSpecs.get(result.location.filePath);
        if (!specContent) {
            // If the file doesn't exist in provided specs (e.g., needsOverrideFile case),
            // fall back to checking the main spec via resolve()
            const readResult = this.resolve(target);
            if (!readResult.location) {
                return undefined;
            }
            specContent = rawSpecs.get(readResult.location.filePath);
            if (!specContent) {
                return undefined;
            }
            // Use the read result's jsonPath
            return this.extractValueAtPath(specContent, readResult.location.jsonPath);
        }

        // Extract the value at the jsonPath
        return this.extractValueAtPath(specContent, result.location.jsonPath);
    }

    /** Extract a value at a JSON path from raw spec content. */
    private extractValueAtPath(specContent: string, jsonPath: string[]): string | undefined {
        try {
            const parsed = yaml.load(specContent) as Record<string, unknown>;
            let value: unknown = parsed;
            for (const key of jsonPath) {
                if (value == null || typeof value !== "object") {
                    return undefined;
                }
                value = (value as Record<string, unknown>)[key];
            }
            return typeof value === "string" ? value : undefined;
        } catch {
            return undefined;
        }
    }

    /**
     * Resolve where to write a description edit, preferring override files.
     *
     * When `preferOverrides` is true:
     * - If the location is already in an override file, use it directly
     * - If not in override but an override file exists, return location in override
     *   with `needsStructureCreation: true` (path may not exist in override yet)
     * - If no override file exists, signal that one needs to be created
     *
     * @param target The description target to resolve
     * @param preferOverrides Whether to prefer writing to override files
     * @returns Write location result with override handling info
     */
    resolveWriteLocation(target: DescriptionTarget, preferOverrides: boolean): OpenApiWriteResult {
        const readResult = this.resolve(target);

        // If we can't find the location at all, return the error
        if (!readResult.location) {
            return { location: null, reason: readResult.reason };
        }

        // If already in an override file, use it directly
        if (readResult.location.isInOverride) {
            return { location: readResult.location };
        }

        // If not preferring overrides, use the resolved location as-is
        if (!preferOverrides) {
            return { location: readResult.location };
        }

        // We want to write to an override file
        const overrideFile = this.findFirstOverrideFile();

        // For inline schemas, inlineJsonPath is set to write inline in operations
        // For $ref schemas, inlineJsonPath is undefined, so we use jsonPath (component path)
        const jsonPathForOverride = readResult.location.inlineJsonPath ?? readResult.location.jsonPath;

        if (overrideFile) {
            // Override file exists, write there (may need to create path structure)
            return {
                location: {
                    filePath: overrideFile,
                    jsonPath: jsonPathForOverride,
                    isInOverride: true,
                    inlineJsonPath: readResult.location.inlineJsonPath
                },
                needsStructureCreation: true
            };
        }

        // No override file exists, signal that one should be created
        return {
            location: {
                ...readResult.location,
                jsonPath: jsonPathForOverride
            },
            needsOverrideFile: true,
            suggestedOverridePath: this.getSuggestedOverridePath()
        };
    }

    /** Find the first override file (if any exist). */
    private findFirstOverrideFile(): string | null {
        for (const filePath of this.overrideFiles) {
            if (this.parsedSpecs.has(filePath)) {
                return filePath;
            }
        }
        return null;
    }

    /** Get a suggested path for a new override file based on main spec location. */
    private getSuggestedOverridePath(): string {
        // Find the directory of the main spec file
        const mainSpecFile = this.getMainSpecFile();
        if (mainSpecFile) {
            const lastSlash = mainSpecFile.lastIndexOf("/");
            const dir = lastSlash > 0 ? mainSpecFile.substring(0, lastSlash) : "";
            // Match the main spec's extension (.json or .yaml/.yml -> .yaml)
            const ext = mainSpecFile.endsWith(".json") ? ".json" : ".yaml";
            const overrideFile = `openapi-overrides${ext}`;
            return dir ? `${dir}/${overrideFile}` : overrideFile;
        }
        return "openapi/openapi-overrides.yaml";
    }

    /** Get the main (non-override) spec file path. */
    private getMainSpecFile(): string | null {
        for (const filePath of this.parsedSpecs.keys()) {
            if (!this.overrideFiles.has(filePath)) {
                return filePath;
            }
        }
        return null;
    }

    /** Get parameter details (name, in) for creating proper overrides. */
    getParameterDetails(target: ParameterDescriptionTarget): { name: string; in: string } | null {
        for (const filePath of this.getFilesByPriority()) {
            const spec = this.parsedSpecs.get(filePath);
            const pathItem = spec?.paths?.[target.path];
            if (!pathItem) {
                continue;
            }

            const operation = pathItem[target.method.toLowerCase() as HttpMethod];
            const opResult = this.findParameterInArray(operation?.parameters, target.paramName, target.paramIn);
            if (opResult) {
                return { name: opResult.param.name, in: opResult.param.in };
            }

            const pathResult = this.findParameterInArray(pathItem.parameters, target.paramName, target.paramIn);
            if (pathResult) {
                return { name: pathResult.param.name, in: pathResult.param.in };
            }
        }
        return null;
    }
}

/** Create a resolver from OpenAPI specs context data. */
export function createResolver(
    specs: Map<string, string> | null,
    overrideFilePaths?: Set<string>
): OpenApiResolver | null {
    if (!specs || specs.size === 0) {
        return null;
    }
    return new OpenApiResolver(specs, overrideFilePaths);
}

/** Get parameter details (name, in) for creating proper overrides. */
export function getParameterDetails(
    resolver: OpenApiResolver | null,
    target: ParameterDescriptionTarget
): { name: string; in: string } | null {
    return resolver?.getParameterDetails(target) ?? null;
}

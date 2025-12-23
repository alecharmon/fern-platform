import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { filterReferencedTypes, type TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import {
    CONTINUE,
    type Hast,
    hastMdxJsxElementHastToProps,
    isMdxJsxElementHast,
    SKIP,
    type Unified,
    unknownToMdxJsxAttribute,
    visit
} from "@fern-docs/mdx";
import { gunzipSync } from "zlib";
import { expandHighlightRanges } from "./expand-highlight-ranges";

import {
    serializeAllTypeDefinitionDescriptions,
    serializeTypeDefinitionDescriptions
} from "./serialize-type-definition-descriptions";

export interface RehypeSchemaOptions {
    loader: DocsLoader;
}

interface MergeSupportedFieldsData {
    model: string;
    apiName?: string;
    integrations: Array<{
        integrationName: string;
        integrationImage: string;
        deletionDetection: "NATIVE" | "ENHANCED";
        supportedFields: string[];
    }>;
}

interface MergeAccessedThirdPartyEndpointsData {
    endpoints: Array<{
        method: string;
        path: string;
        apiName: string;
        models: Array<{
            name: string;
            fields: string[];
        }>;
    }>;
    apiName?: string;
}

/**
 * Decodes base64 gzip JSON data for MergeSupportedFieldsByIntegrationWidget.
 */
function decodeWidgetData(data: string): MergeSupportedFieldsData | null {
    try {
        const binaryString = Buffer.from(data, "base64");
        const decompressed = gunzipSync(binaryString);
        return JSON.parse(decompressed.toString("utf-8")) as MergeSupportedFieldsData;
    } catch (error) {
        console.error("Failed to decode MergeSupportedFieldsByIntegrationWidget data:", error);
        return null;
    }
}

/**
 * Decodes base64 gzip JSON data for MergeAccessedThirdPartyEndpointsWidget.
 */
function decodeEndpointsWidgetData(data: string): MergeAccessedThirdPartyEndpointsData | null {
    try {
        const binaryString = Buffer.from(data, "base64");
        const decompressed = gunzipSync(binaryString);
        // The data is an array of endpoints, wrap it in an object
        const endpoints = JSON.parse(decompressed.toString("utf-8"));
        if (Array.isArray(endpoints)) {
            // Extract apiName from first endpoint if available
            const apiName = endpoints[0]?.apiName;
            return { endpoints, apiName };
        }
        return endpoints as MergeAccessedThirdPartyEndpointsData;
    } catch (error) {
        console.error("Failed to decode MergeAccessedThirdPartyEndpointsWidget data:", error);
        return null;
    }
}

/**
 * This plugin is used to add the `typeDefinition` and `types`
 * props to `Schema` and `SchemaSnippet` nodes. This is necessary to hydrate
 * these nodes with the correct prop values to render.
 *
 * It also pre-serializes all markdown descriptions within the type definitions
 * so they can be rendered correctly in client components.
 */
export const rehypeSchema: Unified.Plugin<[RehypeSchemaOptions?], Hast.Root> = (opts) => {
    if (!opts?.loader) {
        return;
    }
    const { loader } = opts;

    return async (ast: Hast.Root) => {
        const promises: Promise<void>[] = [];

        visit(ast, (node, index, parent) => {
            if (!isMdxJsxElementHast(node) || index == null || parent == null) {
                return CONTINUE;
            }

            if (node.name != null && (node.name === "Schema" || node.name === "SchemaSnippet")) {
                expandHighlightRanges(node);
                const { props } = hastMdxJsxElementHastToProps(node);

                if (typeof props.type !== "string") {
                    return CONTINUE;
                }

                const typeName = props.type.trim();

                promises.push(
                    (async () => {
                        try {
                            const typeDefinitions = await loader.getTypes();

                            for (const typeEntry of Object.entries(typeDefinitions)) {
                                const [_typeEntryId, typeEntryDef] = typeEntry;
                                // Match by the type's name field, not the TypeId key
                                if (typeEntryDef.name === typeName) {
                                    // Filter types to only include those referenced by this type definition
                                    // This significantly reduces payload size for pages with large type registries
                                    const referencedTypes = filterReferencedTypes(typeEntryDef.shape, typeDefinitions);

                                    // Pre-serialize all descriptions for client-side rendering
                                    const [serializedTypeDef, serializedTypes] = await Promise.all([
                                        serializeTypeDefinitionDescriptions(typeEntryDef),
                                        serializeAllTypeDefinitionDescriptions(referencedTypes)
                                    ]);
                                    node.attributes.push(
                                        unknownToMdxJsxAttribute("typeDefinition", serializedTypeDef),
                                        unknownToMdxJsxAttribute("types", serializedTypes)
                                    );
                                    return;
                                }
                            }

                            console.error(
                                `Could not find type with name "${typeName}". Available types: ${Object.entries(
                                    typeDefinitions
                                )
                                    .map(([_, def]) => def.name)
                                    .join(", ")}`
                            );
                        } catch (e) {
                            console.error(`Could not find type "${typeName}"`, e);
                        }
                    })()
                );

                return SKIP;
            }

            // Handle MergeSupportedFieldsByIntegrationWidget separately - extract model from data prop
            if (node.name === "MergeSupportedFieldsByIntegrationWidget") {
                const { props } = hastMdxJsxElementHastToProps(node);

                if (typeof props.data !== "string") {
                    return CONTINUE;
                }

                const decodedData = decodeWidgetData(props.data);
                if (decodedData == null) {
                    return CONTINUE;
                }

                const typeName = decodedData.model;
                const apiName = decodedData.apiName;

                promises.push(
                    (async () => {
                        try {
                            const typeDefinitions = await loader.getTypes(apiName);

                            for (const typeEntry of Object.entries(typeDefinitions)) {
                                const [_typeEntryId, typeEntryDef] = typeEntry;
                                if (typeEntryDef.name === typeName) {
                                    const referencedTypes = filterReferencedTypes(typeEntryDef.shape, typeDefinitions);

                                    const [serializedTypeDef, serializedTypes] = await Promise.all([
                                        serializeTypeDefinitionDescriptions(typeEntryDef),
                                        serializeAllTypeDefinitionDescriptions(referencedTypes)
                                    ]);
                                    node.attributes.push(
                                        unknownToMdxJsxAttribute("typeDefinition", serializedTypeDef),
                                        unknownToMdxJsxAttribute("types", serializedTypes),
                                        // Inject decoded data so component doesn't need to decode at runtime
                                        unknownToMdxJsxAttribute("decodedData", decodedData)
                                    );
                                    return;
                                }
                            }

                            console.error(
                                `Could not find type with name "${typeName}" for MergeSupportedFieldsByIntegrationWidget. Available types: ${Object.entries(
                                    typeDefinitions
                                )
                                    .map(([_, def]) => def.name)
                                    .join(", ")}`
                            );
                        } catch (e) {
                            console.error(
                                `Could not find type "${typeName}" for MergeSupportedFieldsByIntegrationWidget`,
                                e
                            );
                        }
                    })()
                );

                return SKIP;
            }

            // Handle MergeAccessedThirdPartyEndpointsWidget - extract multiple models from data prop
            if (node.name === "MergeAccessedThirdPartyEndpointsWidget") {
                const { props } = hastMdxJsxElementHastToProps(node);

                if (typeof props.data !== "string") {
                    return CONTINUE;
                }

                const decodedData = decodeEndpointsWidgetData(props.data);
                if (decodedData == null) {
                    return CONTINUE;
                }

                // Collect all unique model names from all endpoints
                const modelNames = new Set<string>();
                for (const endpoint of decodedData.endpoints) {
                    for (const model of endpoint.models) {
                        modelNames.add(model.name);
                    }
                }

                const apiName = decodedData.apiName;

                promises.push(
                    (async () => {
                        try {
                            const typeDefinitions = await loader.getTypes(apiName);

                            // Build a map of model name to type definition
                            const modelTypeDefinitions: Record<string, TypeDefinition> = {};
                            let allReferencedTypes: typeof typeDefinitions = {};

                            for (const modelName of modelNames) {
                                for (const typeEntry of Object.entries(typeDefinitions)) {
                                    const [_typeEntryId, typeEntryDef] = typeEntry;
                                    if (typeEntryDef.name === modelName) {
                                        modelTypeDefinitions[modelName] = typeEntryDef;
                                        // Collect referenced types for this model
                                        const referencedTypes = filterReferencedTypes(
                                            typeEntryDef.shape,
                                            typeDefinitions
                                        );
                                        allReferencedTypes = { ...allReferencedTypes, ...referencedTypes };
                                        break;
                                    }
                                }
                            }

                            // Check if we found all models
                            const missingModels = [...modelNames].filter((name) => !modelTypeDefinitions[name]);
                            if (missingModels.length > 0) {
                                console.error(
                                    `Could not find types for models: ${missingModels.join(", ")} for MergeAccessedThirdPartyEndpointsWidget. Available types: ${Object.entries(
                                        typeDefinitions
                                    )
                                        .map(([_, def]) => def.name)
                                        .join(", ")}`
                                );
                            }

                            // Serialize all type definitions
                            const serializedModelTypeDefs: Record<string, unknown> = {};
                            for (const [modelName, typeDef] of Object.entries(modelTypeDefinitions)) {
                                serializedModelTypeDefs[modelName] = await serializeTypeDefinitionDescriptions(typeDef);
                            }

                            const serializedTypes = await serializeAllTypeDefinitionDescriptions(allReferencedTypes);

                            node.attributes.push(
                                unknownToMdxJsxAttribute("typeDefinitions", serializedModelTypeDefs),
                                unknownToMdxJsxAttribute("types", serializedTypes),
                                unknownToMdxJsxAttribute("decodedData", decodedData)
                            );
                        } catch (e) {
                            console.error(`Failed to process MergeAccessedThirdPartyEndpointsWidget`, e);
                        }
                    })()
                );

                return SKIP;
            }

            return CONTINUE;
        });
        if (promises.length > 0) {
            // wait for all promises to resolve before proceeding
            await Promise.all(promises);
        }
    };
};

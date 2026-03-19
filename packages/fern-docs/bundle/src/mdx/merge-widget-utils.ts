import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { filterReferencedTypes, type TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { logger } from "@fern-api/ui-core-utils/logger";
import { gunzipSync } from "zlib";
import {
    serializeAllTypeDefinitionDescriptions,
    serializeTypeDefinitionDescriptions,
    type TypeDefinitionWithSerializedDescriptions
} from "@/mdx/plugins/serialize-type-definition-descriptions";
import { TypesNotInApiError } from "@/server/remote-renderer/errors";

export type RequestType = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

const VALID_REQUEST_TYPES = new Set<string>(["GET", "POST", "PATCH", "DELETE", "PUT"]);

export function isValidRequestType(value: string): value is RequestType {
    return VALID_REQUEST_TYPES.has(value);
}

export interface MergeSupportedFieldsData {
    model: string;
    apiName: string;
    integrations: Array<{
        integrationName: string;
        integrationImage: string;
        deletionDetection: "NATIVE" | "ENHANCED";
        supportedFields: string[];
        requiredParameters?: string[];
        passthroughAvailable: boolean;
    }>;
    supportedFieldsHref?: string;
    linkedAccountsHref?: string;
    passthroughRequestsHref?: string;
    deletedDataDetectionHref?: string;
}

export function decodeWidgetData(data: string): MergeSupportedFieldsData | null {
    try {
        const binaryString = Buffer.from(data, "base64");
        const decompressed = gunzipSync(binaryString);
        return JSON.parse(decompressed.toString("utf-8")) as MergeSupportedFieldsData;
    } catch (error) {
        logger.error("Failed to decode MergeSupportedFieldsByIntegrationWidget data:", error);
        return null;
    }
}

export function buildTypeNameMap(typeDefinitions: Record<string, TypeDefinition>): Map<string, TypeDefinition> {
    const map = new Map<string, TypeDefinition>();
    for (const typeDef of Object.values(typeDefinitions)) {
        if (typeDef.name) {
            map.set(typeDef.name, typeDef);
        }
    }
    return map;
}

/**
 * Resolves widget type data: looks up the type definition by name,
 * filters referenced types, and serializes descriptions.
 *
 * Shared between rehype-schema (MDX pipeline) and
 * MergeSupportedFieldsByIntegrationServer (direct Server Component rendering)
 * to keep resolution logic in sync.
 */
export async function resolveWidgetTypeData(
    loader: DocsLoader,
    decodedData: MergeSupportedFieldsData
): Promise<{
    typeDefinition: TypeDefinitionWithSerializedDescriptions;
    types: Record<string, TypeDefinitionWithSerializedDescriptions>;
} | null> {
    const typeName = decodedData.model;
    const apiName = decodedData.apiName;

    try {
        const typeDefinitions = await loader.getTypes(apiName);
        const typeByName = buildTypeNameMap(typeDefinitions);
        const typeEntryDef = typeByName.get(typeName);

        if (!typeEntryDef) {
            logger.error(
                `Could not find type with name "${typeName}" for MergeSupportedFieldsByIntegrationWidget. Available types: ${Object.entries(
                    typeDefinitions
                )
                    .map(([_, def]) => def.name)
                    .join(", ")}`
            );
            return null;
        }

        const referencedTypes = filterReferencedTypes(typeEntryDef.shape, typeDefinitions);

        const [typeDefinition, types] = await Promise.all([
            serializeTypeDefinitionDescriptions(typeEntryDef),
            serializeAllTypeDefinitionDescriptions(referencedTypes)
        ]);

        return { typeDefinition, types };
    } catch (e) {
        const label = `Failed to resolve MergeSupportedFieldsByIntegrationWidget data for type "${typeName}"${apiName ? ` (api: ${apiName})` : ""}`;
        if (e instanceof TypesNotInApiError) {
            logger.warn(label, e instanceof Error ? e.message : String(e));
        } else {
            logger.error(label, e);
        }
        return null;
    }
}

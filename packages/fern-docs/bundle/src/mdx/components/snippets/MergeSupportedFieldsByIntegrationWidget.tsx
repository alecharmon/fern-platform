"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { SectionContainer } from "@fern-docs/components/api-reference/endpoints/TypeDefinitionAnchor";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionRoot
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { useCurrentSlug } from "@fern-docs/components/hooks/use-current-pathname";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { TypeDefinitionSlotsServer } from "@/components/api-reference/type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "@/components/api-reference/type-definitions/TypeReferenceDefinitions";
import type { TypeDefinitionWithSerializedDescriptions } from "@/mdx/plugins/serialize-type-definition-descriptions";

type DeletionDetection = "NATIVE" | "ENHANCED";
type RequestType = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

interface Integration {
    integrationName: string;
    integrationImage: string;
    deletionDetection: DeletionDetection;
    supportedFields: string[];
    requiredParameters?: string[];
    passthroughAvailable: boolean;
}

/**
 * Checks if a TypeShapeOrReference is a TypeShape (not a TypeReference).
 * TypeShape types: alias, enum, undiscriminatedUnion, discriminatedUnion, object
 * TypeReference types: id, primitive, optional, nullable, list, set, map, literal, unknown
 */
function isTypeShape(shape: ApiDefinition.TypeShapeOrReference): shape is ApiDefinition.TypeShape {
    return (
        shape.type === "alias" ||
        shape.type === "enum" ||
        shape.type === "undiscriminatedUnion" ||
        shape.type === "discriminatedUnion" ||
        shape.type === "object"
    );
}

/**
 * Converts a TypeShapeOrReference to a TypeShape by wrapping TypeReferences in an alias.
 */
function toTypeShape(shape: ApiDefinition.TypeShapeOrReference): ApiDefinition.TypeShape {
    if (isTypeShape(shape)) {
        return shape;
    }
    // Wrap TypeReference in an alias to make it a TypeShape
    return { type: "alias", value: shape };
}

/**
 * Checks if a shape is optional (either directly or wrapped in an alias).
 */
function isOptionalShape(shape: ApiDefinition.TypeShapeOrReference): boolean {
    if (shape.type === "optional" || shape.type === "nullable") {
        return true;
    }
    // Check if it's an alias wrapping an optional
    if (shape.type === "alias" && (shape.value.type === "optional" || shape.value.type === "nullable")) {
        return true;
    }
    return false;
}

/**
 * Wraps a type shape in an optional wrapper if it's not already optional/nullable.
 */
function wrapAsOptional(shape: ApiDefinition.TypeShapeOrReference): ApiDefinition.TypeShapeOrReference {
    if (isOptionalShape(shape)) {
        return shape;
    }
    // Wrap in an alias containing an optional
    return {
        type: "alias",
        value: { type: "optional", shape: toTypeShape(shape), default: undefined }
    };
}

/**
 * Unwraps an optional type shape, returning the inner shape.
 * Handles both direct optional wrappers and aliases containing optionals.
 */
function unwrapOptional(shape: ApiDefinition.TypeShapeOrReference): ApiDefinition.TypeShapeOrReference {
    if (shape.type === "optional") {
        return shape.shape;
    }
    // Handle alias wrapping an optional - return the inner TypeShape directly
    if (shape.type === "alias" && shape.value.type === "optional") {
        return shape.value.shape;
    }
    // Handle alias wrapping a nullable - return the inner TypeShape directly
    if (shape.type === "alias" && shape.value.type === "nullable") {
        return shape.value.shape;
    }
    return shape;
}

interface MergeSupportedFieldsData {
    model: string;
    integrations: Integration[];
    apiName: string;
    supportedFieldsHref?: string;
    linkedAccountsHref?: string;
    passthroughRequestsHref?: string;
    deletedDataDetectionHref?: string;
}

type MergeSupportedFieldsByIntegrationWidgetProps = {
    /**
     * Base64 gzip-encoded JSON data containing model and integrations.
     * The rehype-schema plugin will decode this to extract the model name
     * and inject the corresponding typeDefinition, types, and decodedData.
     */
    data: string;
    /**
     * @internal injected by rehype-schema plugin - the decoded data from the gzip payload
     */
    decodedData?: MergeSupportedFieldsData;
    /**
     * @internal injected by rehype-schema plugin based on the model in data
     */
    typeDefinition?: ApiDefinition.TypeDefinition | TypeDefinitionWithSerializedDescriptions;
    /**
     * @internal injected by rehype-schema plugin
     */
    types?: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang?: string;
    className?: string;
    requestType?: RequestType;
};

const INITIAL_VISIBLE_COUNT = 3;

function IntegrationRow({
    integration,
    isExpanded,
    onToggle,
    typeDefinition,
    types,
    lang,
    requestType,
    passthroughRequestsHref,
    deletedDataDetectionHref
}: {
    integration: Integration;
    isExpanded: boolean;
    onToggle: () => void;
    typeDefinition: ApiDefinition.TypeDefinition | TypeDefinitionWithSerializedDescriptions;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang: string;
    requestType?: RequestType;
    passthroughRequestsHref?: string;
    deletedDataDetectionHref?: string;
}) {
    const rowRef = useRef<HTMLDivElement>(null);
    const expandableRef = useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        const expandable = expandableRef.current;
        if (expandable) {
            const onTransitionEnd = () => {
                expandable.removeEventListener("transitionend", onTransitionEnd);
                rowRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            };
            expandable.addEventListener("transitionend", onTransitionEnd);
        }
        onToggle();
    };

    const requiredParams = new Set(integration.requiredParameters ?? []);

    // Filter the shape's properties to only show supported fields,
    // and transform valueShape based on requiredParameters
    const { filteredShape, additionalRequiredParams } = (() => {
        const shape = typeDefinition.shape;
        if (shape.type !== "object") {
            return { filteredShape: shape, additionalRequiredParams: [] as string[] };
        }

        const supportedFieldKeys = new Set(integration.supportedFields);
        // Convert PropertyKey to string for comparison
        const schemaPropertyKeys = new Set(shape.properties.map((p) => String(p.key)));

        // Find required parameters that don't exist in the schema
        const additionalParams = (integration.requiredParameters ?? []).filter(
            (param) => !schemaPropertyKeys.has(param)
        );

        const filteredProperties = shape.properties
            .filter((property) => supportedFieldKeys.has(String(property.key)))
            .map((property) => {
                const propertyKey = String(property.key);
                const isRequired = requiredParams.has(propertyKey);
                return {
                    ...property,
                    valueShape: isRequired ? unwrapOptional(property.valueShape) : wrapAsOptional(property.valueShape)
                };
            });

        return {
            filteredShape: {
                ...shape,
                properties: filteredProperties
            } as ApiDefinition.TypeShape,
            additionalRequiredParams: additionalParams
        };
    })();

    const schemaName = typeDefinition.displayName || typeDefinition.name || "schema";

    return (
        <div ref={rowRef} className="scroll-mt-4 border-b border-[#e0e0e0] last:border-b-0">
            <button
                type="button"
                onClick={handleToggle}
                className="flex w-full cursor-pointer items-center gap-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
                {integration.integrationImage && (
                    <Image
                        src={integration.integrationImage}
                        alt={`${integration.integrationName} logo`}
                        width={24}
                        height={24}
                        className="m-0! rounded object-contain"
                        unoptimized
                    />
                )}
                <span className="flex-1 text-base font-medium">{integration.integrationName}</span>
                <ChevronRight
                    className={`text-muted h-5 w-5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                />
            </button>
            <div
                ref={expandableRef}
                className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
            >
                <div className="overflow-hidden">
                    <div className="pb-2">
                        {integration.passthroughAvailable && passthroughRequestsHref ? (
                            <p className="text-muted mb-3 mt-0 text-sm">
                                On top of normalized Common Models, Merge also supports{" "}
                                <a href={passthroughRequestsHref} className="text-accent hover:underline">
                                    Passthrough Requests
                                </a>
                                {requestType === "GET" && deletedDataDetectionHref && (
                                    <>
                                        {" "}
                                        and{" "}
                                        <a href={deletedDataDetectionHref} className="text-accent hover:underline">
                                            deleted data detection
                                        </a>
                                    </>
                                )}{" "}
                                for this platform's API
                            </p>
                        ) : (
                            <div className="mt-2" />
                        )}
                        <div className="rounded-2 overflow-hidden border border-[#e0e0e0] bg-[#fbfcfd] dark:border-gray-700 dark:bg-gray-800/30">
                            <div className="border-b border-[#e0e0e0] px-3 py-1 dark:border-gray-700">
                                <span className="text-xs font-semibold">
                                    {requestType === "GET"
                                        ? "Supported response fields"
                                        : `Supported ${requestType} model parameters`}
                                </span>
                            </div>
                            <div className="px-3 py-2">
                                <TypeDefinitionAnchorPart part={schemaName}>
                                    <SectionContainer>
                                        <TypeReferenceDefinitions
                                            shape={filteredShape}
                                            types={types}
                                            lang={lang}
                                            exclude={[]}
                                            excludeDeprecated={false}
                                        />
                                    </SectionContainer>
                                </TypeDefinitionAnchorPart>
                            </div>
                        </div>
                        {additionalRequiredParams.length > 0 && (
                            <div className="rounded-2 mt-6 overflow-hidden border border-[#e0e0e0] bg-[#fbfcfd] dark:border-gray-700 dark:bg-gray-800/30">
                                <div className="border-b border-[#e0e0e0] px-3 py-1 dark:border-gray-700">
                                    <span className="text-xs font-semibold">
                                        {requestType === "GET"
                                            ? "Additional parameters"
                                            : `Additional ${requestType} parameters`}
                                    </span>
                                </div>
                                <div className="space-y-1 px-3 py-2">
                                    {additionalRequiredParams.map((param) => (
                                        <div key={param} className="flex items-center gap-2 text-sm">
                                            <code className="bg-tag-default rounded px-1.5 py-0.5 font-mono text-xs">
                                                {param}
                                            </code>
                                            <span className="text-(color:--red-a11) text-xs">Required</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function MergeSupportedFieldsByIntegrationWidget({
    decodedData,
    typeDefinition,
    types,
    lang,
    className,
    requestType
}: MergeSupportedFieldsByIntegrationWidgetProps) {
    const currentSlug = useCurrentSlug();
    const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    if (decodedData == null || typeDefinition == null || types == null) {
        return null;
    }

    const language = lang ?? "en";
    const integrations = decodedData.integrations;
    const initialIntegrations = integrations.slice(0, INITIAL_VISIBLE_COUNT);
    const additionalIntegrations = integrations.slice(INITIAL_VISIBLE_COUNT);
    const hiddenCount = additionalIntegrations.length;

    return (
        <TypeDefinitionRoot types={types} slug={currentSlug}>
            <TypeDefinitionSlotsServer types={types} lang={language}>
                <div className={className}>
                    <div className="mb-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex w-full justify-between gap-4">
                                <h3 className="m-0! text-xl font-semibold">Field support by integration</h3>
                                {decodedData.supportedFieldsHref && (
                                    <Link
                                        href={decodedData.supportedFieldsHref}
                                        className="text-accent flex gap-1 text-sm hover:underline"
                                    >
                                        See all supported fields
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Link>
                                )}
                            </div>
                        </div>
                        {decodedData.linkedAccountsHref && (
                            <p className="text-muted mt-3 text-sm">
                                Use the{" "}
                                <a href={decodedData.linkedAccountsHref} className="text-accent hover:underline">
                                    /linked-accounts
                                </a>{" "}
                                endpoint to pull platform support information
                            </p>
                        )}
                    </div>
                    <div>
                        {initialIntegrations.map((integration) => (
                            <IntegrationRow
                                key={integration.integrationName}
                                integration={integration}
                                isExpanded={expandedIntegration === integration.integrationName}
                                onToggle={() =>
                                    setExpandedIntegration(
                                        expandedIntegration === integration.integrationName
                                            ? null
                                            : integration.integrationName
                                    )
                                }
                                typeDefinition={typeDefinition}
                                types={types}
                                lang={language}
                                requestType={requestType}
                                passthroughRequestsHref={decodedData.passthroughRequestsHref}
                                deletedDataDetectionHref={decodedData.deletedDataDetectionHref}
                            />
                        ))}
                        {hiddenCount > 0 && (
                            <>
                                <div
                                    className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                                    style={{ gridTemplateRows: showAll ? "1fr" : "0fr" }}
                                >
                                    <div className="overflow-hidden">
                                        {additionalIntegrations.map((integration) => (
                                            <IntegrationRow
                                                key={integration.integrationName}
                                                integration={integration}
                                                isExpanded={expandedIntegration === integration.integrationName}
                                                onToggle={() =>
                                                    setExpandedIntegration(
                                                        expandedIntegration === integration.integrationName
                                                            ? null
                                                            : integration.integrationName
                                                    )
                                                }
                                                typeDefinition={typeDefinition}
                                                types={types}
                                                lang={language}
                                                requestType={requestType}
                                                passthroughRequestsHref={decodedData.passthroughRequestsHref}
                                                deletedDataDetectionHref={decodedData.deletedDataDetectionHref}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAll(!showAll)}
                                    className="border-default text-muted mt-4 flex w-full cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                    <ChevronDown
                                        className={`h-4 w-4 transition-transform duration-200 ${showAll ? "rotate-180" : ""}`}
                                    />
                                    <span>{showAll ? "Show less" : `Show ${hiddenCount} more`}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </TypeDefinitionSlotsServer>
        </TypeDefinitionRoot>
    );
}

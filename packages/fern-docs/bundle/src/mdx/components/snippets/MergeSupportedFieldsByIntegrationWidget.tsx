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
import { useState } from "react";

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
    passthroughAvailable: boolean;
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
    // Filter the shape's properties to only show supported fields
    let filteredShape = typeDefinition.shape;
    if (filteredShape.type === "object") {
        const filteredProperties = filteredShape.properties.filter((property) =>
            integration.supportedFields.includes(property.key)
        );
        filteredShape = {
            ...filteredShape,
            properties: filteredProperties
        };
    }

    const schemaName = typeDefinition.displayName || typeDefinition.name || "schema";

    return (
        <div className="border-b border-[#e0e0e0] last:border-b-0">
            <button
                type="button"
                onClick={onToggle}
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

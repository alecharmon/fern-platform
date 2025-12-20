"use client";

import type { HttpMethod } from "@fern-api/docs-utils";
import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { SectionContainer } from "@fern-docs/components/api-reference/endpoints/TypeDefinitionAnchor";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionRoot
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { useCurrentSlug } from "@fern-docs/components/hooks/use-current-pathname";
import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { TypeDefinitionSlotsServer } from "@/components/api-reference/type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "@/components/api-reference/type-definitions/TypeReferenceDefinitions";
import type { TypeDefinitionWithSerializedDescriptions } from "@/mdx/plugins/serialize-type-definition-descriptions";

const METHOD_COLORS: Record<HttpMethod, string> = {
    GET: "text-[#3b82f6]",
    POST: "text-[#00b187]",
    PUT: "text-[#6366f1]",
    PATCH: "text-[#eab308]",
    DELETE: "text-[#ea0524]",
    HEAD: "text-black dark:text-white",
    OPTIONS: "text-black dark:text-white",
    CONNECT: "text-black dark:text-white",
    TRACE: "text-black dark:text-white"
};

function MethodText({ method }: { method: HttpMethod }) {
    return (
        <span className={`shrink-0 font-semibold ${METHOD_COLORS[method] ?? "text-[var(--gray-a11)]"}`}>{method}</span>
    );
}

interface EndpointModel {
    name: string;
    fields: string[];
}

interface EndpointData {
    method: HttpMethod;
    path: string;
    apiName: string;
    models: EndpointModel[];
}

interface MergeAccessedThirdPartyEndpointsData {
    endpoints: EndpointData[];
    apiName?: string;
}

type MergeAccessedThirdPartyEndpointsWidgetProps = {
    /**
     * Base64 gzip-encoded JSON data containing endpoints and models.
     * The rehype-schema plugin will decode this to extract the model names
     * and inject the corresponding typeDefinitions, types, and decodedData.
     */
    data: string;
    /**
     * @internal injected by rehype-schema plugin - the decoded data from the gzip payload
     */
    decodedData?: MergeAccessedThirdPartyEndpointsData;
    /**
     * @internal injected by rehype-schema plugin based on the models in data
     * Maps model names to their type definitions
     */
    typeDefinitions?: Record<string, ApiDefinition.TypeDefinition | TypeDefinitionWithSerializedDescriptions>;
    /**
     * @internal injected by rehype-schema plugin
     */
    types?: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang?: string;
    className?: string;
};

function ModelAccordion({
    model,
    typeDefinition,
    types,
    lang,
    isExpanded,
    onToggle,
    accordionKey
}: {
    model: EndpointModel;
    typeDefinition: ApiDefinition.TypeDefinition | TypeDefinitionWithSerializedDescriptions | undefined;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang: string;
    isExpanded: boolean;
    onToggle: () => void;
    accordionKey: string;
}) {
    const accordionRef = useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        onToggle();
        if (!isExpanded) {
            // Will be expanding - scroll into view after animation completes
            setTimeout(() => {
                accordionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });
            }, 300);
        }
    };

    if (typeDefinition == null) {
        return null;
    }

    // Filter the shape's properties to only show supported fields
    let filteredShape = typeDefinition.shape;
    if (filteredShape.type === "object") {
        const filteredProperties = filteredShape.properties.filter((property) => model.fields.includes(property.key));
        filteredShape = {
            ...filteredShape,
            properties: filteredProperties
        };
    }

    const schemaName = typeDefinition.displayName || typeDefinition.name || "schema";

    return (
        <div
            ref={accordionRef}
            className={`scroll-mt-4 border-b border-[#e0e0e0] transition-colors duration-200 last:border-b-0 dark:border-gray-700 ${isExpanded ? "bg-[#fbfcfd] dark:bg-gray-800/30" : ""}`}
        >
            <button
                type="button"
                onClick={handleToggle}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
                <span
                    className={`transition-all duration-200 ${isExpanded ? "text-[20px] font-semibold" : "font-medium"}`}
                >
                    Access {model.name} Information
                </span>
                <ChevronRight
                    className={`text-muted h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                />
            </button>
            <div
                className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
            >
                <div className="overflow-hidden">
                    <div className="max-h-[600px] overflow-y-auto px-3 py-2">
                        <div className="text-sm font-bold text-[#8492a6]">{schemaName} fields</div>
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

function EndpointRow({
    endpoint,
    typeDefinitions,
    types,
    lang,
    expandedModel,
    onToggleModel
}: {
    endpoint: EndpointData;
    typeDefinitions: Record<string, ApiDefinition.TypeDefinition | TypeDefinitionWithSerializedDescriptions>;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang: string;
    expandedModel: string | null;
    onToggleModel: (key: string) => void;
}) {
    return (
        <div className="border-b border-[#e0e0e0] py-4 last:border-b-0 dark:border-gray-700">
            <div className="flex flex-col gap-4 min-[1100px]:flex-row min-[1100px]:items-start min-[1100px]:justify-between">
                {/* Left side: Method and path */}
                <div className="flex min-w-[150px] items-center gap-2">
                    <MethodText method={endpoint.method} />
                    <div className="break-all text-sm">{endpoint.path}</div>
                </div>

                {/* Right side: Model accordions */}
                <div className="rounded-2 w-full shrink grow-0 overflow-hidden border border-[#eaeef3] min-[1100px]:shrink-0 min-[1100px]:basis-[540px] dark:border-gray-700">
                    <div className="border-b border-[#e0e0e0] px-2 py-2 dark:border-gray-700">
                        <span className="text-sm font-bold">Merge interacts with this API endpoint to...</span>
                    </div>
                    {endpoint.models.map((model) => {
                        const key = `${endpoint.method}-${endpoint.path}-${model.name}`;
                        return (
                            <ModelAccordion
                                key={key}
                                accordionKey={key}
                                model={model}
                                typeDefinition={typeDefinitions[model.name]}
                                types={types}
                                lang={lang}
                                isExpanded={expandedModel === key}
                                onToggle={() => onToggleModel(key)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function MergeAccessedThirdPartyEndpointsWidget({
    decodedData,
    typeDefinitions,
    types,
    lang,
    className
}: MergeAccessedThirdPartyEndpointsWidgetProps) {
    const currentSlug = useCurrentSlug();
    const [expandedModel, setExpandedModel] = useState<string | null>(null);

    if (decodedData == null || typeDefinitions == null || types == null) {
        return null;
    }

    const language = lang ?? "en";
    const endpoints = decodedData.endpoints;

    const handleToggleModel = (key: string) => {
        setExpandedModel((prev) => (prev === key ? null : key));
    };

    return (
        <TypeDefinitionRoot types={types} slug={currentSlug}>
            <TypeDefinitionSlotsServer types={types} lang={language}>
                <div className={className}>
                    <div className="mb-4 border-b border-[#e0e0e0] pb-4 dark:border-gray-700">
                        <h3 className="m-0! text-xl font-semibold">API Endpoints</h3>
                    </div>
                    <div>
                        {endpoints.map((endpoint, index) => (
                            <EndpointRow
                                key={`${endpoint.method}-${endpoint.path}-${index}`}
                                endpoint={endpoint}
                                typeDefinitions={typeDefinitions}
                                types={types}
                                lang={language}
                                expandedModel={expandedModel}
                                onToggleModel={handleToggleModel}
                            />
                        ))}
                    </div>
                </div>
            </TypeDefinitionSlotsServer>
        </TypeDefinitionRoot>
    );
}

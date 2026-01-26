"use client";

import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import titleCase from "@fern-api/ui-core-utils/titleCase";
import { FernCollapseWithButtonUncontrolled } from "@fern-docs/components/api-reference/type-definitions/FernCollapseWithButtonUncontrolled";
import { TypeDefinitionPathPart } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ObjectProperty } from "./ObjectProperty";
import type { PropertyLocation } from "./TypeReferenceDefinitions";

export function DiscriminatedUnionVariantSelector({
    discriminant,
    variants,
    types,
    location,
    lang = "en"
}: {
    discriminant: ApiDefinition.PropertyKey;
    variants: ApiDefinition.DiscriminatedUnionVariant[];
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    lang?: string;
}) {
    const [selectedVariantValue, setSelectedVariantValue] = useState<string>(variants[0]?.discriminantValue ?? "");

    const selectedVariant = variants.find((v) => v.discriminantValue === selectedVariantValue);

    if (!selectedVariant) {
        return null;
    }

    const dropdownOptions: FernDropdown.ValueOption[] = variants.map((variant) => ({
        type: "value" as const,
        value: variant.discriminantValue,
        label: variant.displayName ?? titleCase(variant.discriminantValue)
    }));

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-(color:--grayscale-a11) text-sm">Variant:</span>
                <FernDropdown
                    options={dropdownOptions}
                    value={selectedVariantValue}
                    onValueChange={setSelectedVariantValue}
                    triggerAsChild={false}
                    lang={lang}
                >
                    <button className="border-border-default bg-tag-default hover:bg-tag-default-hover flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-sm transition-colors">
                        <span>{selectedVariant.displayName ?? titleCase(selectedVariantValue)}</span>
                        <ChevronDown className="h-3 w-3" />
                    </button>
                </FernDropdown>
            </div>
            <div>
                <DiscriminatedUnionVariantContent
                    discriminant={discriminant}
                    unionVariant={selectedVariant}
                    types={types}
                    location={location}
                    lang={lang}
                />
            </div>
        </div>
    );
}

function DiscriminatedUnionVariantContent({
    discriminant,
    unionVariant,
    types,
    location,
    lang = "en"
}: {
    discriminant: ApiDefinition.PropertyKey;
    unionVariant: ApiDefinition.DiscriminatedUnionVariant;
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    lang?: string;
}) {
    const unwrapped = ApiDefinition.unwrapDiscriminatedUnionVariant({ discriminant }, unionVariant, types);
    const properties = unwrapped.properties;

    if (properties.length === 0) {
        return null;
    }

    // Render the variant properties directly in a collapsible box
    // without the outer wrapper that shows the variant name or discriminant
    return (
        <TypeDefinitionPathPart
            part={{
                type: "objectFilter",
                propertyName: discriminant,
                requiredStringValue: unionVariant.discriminantValue
            }}
        >
            <FernCollapseWithButtonUncontrolled
                showText={`Show ${properties.length} properties`}
                hideText={`Hide ${properties.length} properties`}
            >
                <WithSeparator>
                    {properties.map((property) => (
                        <TypeDefinitionPathPart
                            key={property.key}
                            part={{ type: "objectProperty", propertyName: property.key }}
                        >
                            <ObjectProperty property={property} types={types} location={location} lang={lang} />
                        </TypeDefinitionPathPart>
                    ))}
                </WithSeparator>
            </FernCollapseWithButtonUncontrolled>
        </TypeDefinitionPathPart>
    );
}

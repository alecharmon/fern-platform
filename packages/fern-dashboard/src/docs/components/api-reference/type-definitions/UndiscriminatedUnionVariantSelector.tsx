"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { UndiscriminatedUnionVariant } from "./UndiscriminatedUnionVariant";

export function UndiscriminatedUnionVariantSelector({
    variants,
    types,
    location,
    additionalProperties,
    lang = "en"
}: {
    variants: ApiDefinition.UndiscriminatedUnionVariant[];
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: "request" | "response";
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang?: string;
}) {
    const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

    const selectedVariant = variants[selectedVariantIndex];

    if (!selectedVariant) {
        return null;
    }

    const dropdownOptions: FernDropdown.ValueOption[] = variants.map((variant, index) => ({
        type: "value" as const,
        value: String(index),
        label: variant.displayName ?? `Variant ${index + 1}`
    }));

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-(color:--grayscale-a11) text-sm">Variant:</span>
                <FernDropdown
                    options={dropdownOptions}
                    value={String(selectedVariantIndex)}
                    onValueChange={(value) => setSelectedVariantIndex(Number(value))}
                    triggerAsChild={false}
                    lang={lang}
                >
                    <button className="border-border-default bg-tag-default hover:bg-tag-default-hover flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-sm transition-colors">
                        <span>{selectedVariant.displayName ?? `Variant ${selectedVariantIndex + 1}`}</span>
                        <ChevronDown className="h-3 w-3" />
                    </button>
                </FernDropdown>
            </div>
            <div>
                <UndiscriminatedUnionVariant
                    unionVariant={selectedVariant}
                    idx={selectedVariantIndex}
                    types={types}
                    location={location}
                    additionalProperties={additionalProperties}
                    lang={lang}
                />
            </div>
        </div>
    );
}

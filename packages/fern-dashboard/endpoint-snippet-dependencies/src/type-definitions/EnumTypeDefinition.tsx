"use client";

import { FernButton } from "@fern-docs/components/FernButton";
import { FernInput } from "@fern-docs/components/FernInput";
import { FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useBooleanState } from "@fern-ui/react-commons";
import { Search, X } from "lucide-react";
import React, { useState } from "react";

import { EnumDefinitionDetails } from "./EnumDefinitionDetails";
import { FernCollapseWithButton } from "./FernCollapseWithButton";

export type Ref = React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;

export interface EnumTypeDefinitionProps {
    elements: {
        element: React.ReactNode;
        searchableString: string;
    }[];
    ChipSizeProvider: React.ComponentType<{
        children: React.ReactNode;
        size: "sm" | "lg";
    }>;
}

export function EnumTypeDefinition({ elements, ChipSizeProvider }: EnumTypeDefinitionProps) {
    const collapse = useBooleanState(false);
    const autofocus = useBooleanState(false);
    const [searchInput, setSearchInput] = useState("");
    const hideText = (
        <div className="-mx-1 py-1">
            <FernInput
                type="search"
                placeholder="Search..."
                value={searchInput}
                onClick={(e) => {
                    e.stopPropagation();
                }}
                onValueChange={setSearchInput}
                className="w-full"
                style={{ flex: 1, backgroundColor: "transparent" }}
                leftIcon={<Search className="text-(color:--grayscale-a11) size-4" />}
                rightElement={<FernButton icon={<X />} variant="minimal" />}
                lang="en" // TODO: add language
            />
        </div>
    );

    return (
        <>
            {elements.length < 6 ? (
                <div className="text-(color:--grayscale-a11) flex items-baseline gap-2">
                    <span className="shrink-0 text-sm">Allowed values:</span>
                    <FernTooltipProvider>
                        <ChipSizeProvider size="sm">
                            <span className="inline-flex flex-wrap gap-2">
                                {elements.map((element, key) => (
                                    <React.Fragment key={key}>{element.element}</React.Fragment>
                                ))}
                            </span>
                        </ChipSizeProvider>
                    </FernTooltipProvider>
                </div>
            ) : (
                <FernCollapseWithButton
                    isOpen={collapse.value}
                    toggleIsOpen={collapse.toggleValue}
                    showText={`Show ${elements.length} enum values`}
                    hideText={hideText}
                    buttonProps={{
                        className: collapse.value ? "multiline" : undefined,
                        disableAutomaticTooltip: true,
                        onClickCapture: () => {
                            if (collapse.value) {
                                autofocus.setTrue();
                            }
                        }
                    }}
                >
                    <EnumDefinitionDetails elements={elements} searchInput={searchInput} />
                </FernCollapseWithButton>
            )}
        </>
    );
}

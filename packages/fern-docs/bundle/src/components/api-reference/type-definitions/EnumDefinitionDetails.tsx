"use client";

import { Empty } from "@fern-docs/components/Empty";
import { t } from "@fern-docs/i18n";
import React from "react";

export interface EnumDefinitionDetailsProps {
    elements: {
        element: React.ReactNode;
        searchableString: string;
    }[];
    searchInput: string;
    lang: string;
}

export function EnumDefinitionDetails({ elements, searchInput, lang }: EnumDefinitionDetailsProps) {
    console.log(elements);
    const [filteredElements, setFilteredElements] = React.useState<React.ReactNode[]>(() =>
        elements.map((element) => element.element)
    );

    React.useEffect(() => {
        setFilteredElements(
            elements
                .filter((element) => {
                    if (searchInput.trim() === "") {
                        return true;
                    }

                    return element.searchableString.toLowerCase().includes(searchInput.toLowerCase());
                })
                .map((element) => element.element)
        );
    }, [elements, searchInput]);

    // use 140px to decapitate overflowing enum values and indicate scrollability
    return (
        <div className="max-h-[140px] gap-2 overflow-y-auto p-2">
            {filteredElements.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {filteredElements.map((element, key) => (
                        <React.Fragment key={key}>{element}</React.Fragment>
                    ))}
                </div>
            ) : (
                <Empty name={t(lang).search.noResults} description={t(lang).errors.noEnumValuesFound} />
            )}
        </div>
    );
}

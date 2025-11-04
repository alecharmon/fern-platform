"use client";

import { Badge } from "@fern-docs/components/badges";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernTooltip } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import { ChevronDown } from "lucide-react";
import { useSelectedFilters, useSetSelectedFilters } from "@/state/search";

export function PageFilters({
    filters,
    forcePillDisplay,
    lang
}: {
    filters: string[];
    forcePillDisplay?: boolean;
    lang: string;
}) {
    const selectedFilters = useSelectedFilters();
    const setSelectedFilters = useSetSelectedFilters();

    const handleFilterClick = (filter: string) => {
        if (filter === "All") {
            setSelectedFilters([]);
            return;
        }

        setSelectedFilters(
            selectedFilters.includes(filter)
                ? selectedFilters.filter((f: string) => f !== filter)
                : [...selectedFilters, filter]
        );
    };

    if (filters.length === 0) {
        return null;
    }

    if (filters.length > 5 && !forcePillDisplay) {
        return (
            <FernDropdown
                options={filters.map((filter) => ({
                    type: "value",
                    value: filter,
                    label: filter,
                    className: "hover:text-(color:--accent-contrast) hover:bg-(color:--accent) w-[12rem]",
                    labelClassName: "truncate w-full"
                }))}
                value={selectedFilters.length > 0 ? selectedFilters : ["All"]}
                onValueChange={handleFilterClick}
                lang={lang}
            >
                <FernButton variant="outlined">
                    <div className="flex w-[10rem] items-center justify-between gap-2 truncate">
                        {filterText(selectedFilters, lang)}
                        <ChevronDown className="size-icon" />
                    </div>
                </FernButton>
            </FernDropdown>
        );
    }

    return (
        <>
            {filters.map((filter) => (
                <FernTooltip key={filter} content={filter}>
                    <Badge
                        key={filter}
                        variant={
                            selectedFilters.includes(filter) || (filter === "All" && selectedFilters.length === 0)
                                ? "outlined"
                                : "outlined-subtle"
                        }
                        interactive
                        onClick={() => handleFilterClick(filter)}
                        className="fern-filter-badge"
                    >
                        {filter}
                    </Badge>
                </FernTooltip>
            ))}
        </>
    );
}

function filterText(selectedFilters: string[], lang: string) {
    if (selectedFilters.length === 0) {
        return t(lang).search.selectFilters;
    }

    if (selectedFilters.join(", ").length < 12) {
        return selectedFilters.join(", ");
    }

    return selectedFilters.length === 1 ? selectedFilters[0] : `${selectedFilters.length} Filters`;
}

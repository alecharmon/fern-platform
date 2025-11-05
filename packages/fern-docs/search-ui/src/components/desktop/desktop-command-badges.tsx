import { tunnel } from "@fern-ui/react-commons";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { useFacetFilters } from "../search/useFacetFilters";
import { DesktopFilterDropdownMenu } from "./desktop-filter-dropdown-menu";

interface DesktopCommandBadgesProps {
    onDropdownClose?: () => void;
    lang: string;
}

export const aboveInput = tunnel();

export const DesktopCommandBadges = forwardRef<
    HTMLDivElement,
    DesktopCommandBadgesProps & ComponentPropsWithoutRef<"div">
>((props, ref) => {
    const { onDropdownClose, children, lang, ...rest } = props;
    const { filters, setFilters } = useFacetFilters();
    const hasChildren = aboveInput.useHasChildren();

    if ((filters == null || filters.length === 0) && !hasChildren) {
        return false;
    }

    return (
        <div ref={ref} className="flex items-center gap-2 p-2 pb-0" {...rest}>
            {filters?.map((filter) => (
                <DesktopFilterDropdownMenu
                    key={`${filter.facet}:${filter.value}`}
                    filter={filter}
                    filters={filters}
                    removeFilter={() => {
                        setFilters?.((prev) => prev.filter((f) => f.facet !== filter.facet));
                    }}
                    updateFilter={(value) => {
                        setFilters?.((prev) => prev.map((f) => (f.facet === filter.facet ? { ...f, value } : f)));
                    }}
                    lang={lang}
                />
            ))}
            <aboveInput.Out />
        </div>
    );
});

DesktopCommandBadges.displayName = "DesktopCommandBadges";

export const DesktopCommandAboveInput = aboveInput.In;

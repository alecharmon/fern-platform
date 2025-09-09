"use client";

import { ChevronDown } from "lucide-react";

import {
  Badge,
  FernButton,
  FernDropdown,
  FernTooltip,
} from "@fern-docs/components";

import { useSelectedFilters, useSetSelectedFilters } from "@/state/search";

export function PageFilters({
  filters,
  forcePillDisplay,
}: {
  filters: string[];
  forcePillDisplay?: boolean;
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
          className:
            "hover:text-(color:--accent-contrast) hover:bg-(color:--accent) w-[12rem]",
          labelClassName: "truncate w-full",
        }))}
        value={selectedFilters.length > 0 ? selectedFilters : ["All"]}
        onValueChange={handleFilterClick}
      >
        <FernButton variant="outlined">
          <div className="flex w-[10rem] items-center justify-between gap-2 truncate">
            {filterText(selectedFilters)}
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
              selectedFilters.includes(filter) ||
              (filter === "All" && selectedFilters.length === 0)
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

function filterText(selectedFilters: string[]) {
  if (selectedFilters.length === 0) {
    return "Select filters";
  }

  if (selectedFilters.join(", ").length < 12) {
    return selectedFilters.join(", ");
  }

  return selectedFilters.length === 1
    ? selectedFilters[0]
    : `${selectedFilters.length} Filters`;
}

"use client";

import { Badge } from "@fern-docs/components";

import { useSelectedFilters, useSetSelectedFilters } from "@/state/search";

export function PageFilters({ filters }: { filters: string[] }) {
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

  // todo: add dropdown for more than 5 filters

  return (
    <div className="flex flex-row gap-2 overflow-x-auto">
      {filters.map((filter) => (
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
          className="fern-filter-badge cursor-pointer"
        >
          {filter}
        </Badge>
      ))}
    </div>
  );
}

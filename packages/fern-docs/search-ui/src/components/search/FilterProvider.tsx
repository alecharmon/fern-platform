import { useMemo } from "react";

import { atom, useAtom } from "jotai";
import { atomWithDefault } from "jotai/utils";

import type { FacetFilter } from "@fern-docs/search-keyword";

export const filtersAtom = atomWithDefault<readonly FacetFilter[]>(() => []);

export type FiltersContext = {
    filtersAtom: typeof filtersAtom;
};

export interface FiltersManager<T = readonly FacetFilter[]> {
    filters: T;
    setFilters: React.Dispatch<React.SetStateAction<T>>;
}

export function createFiltersContext(): FiltersContext {
    return { filtersAtom };
}

export function useFilters(): FiltersManager {
    const [filters, setFilters] = useAtom(filtersAtom);
    return useMemo(() => {
        return {
            filters,
            setFilters
        };
    }, [filters, setFilters]);
}

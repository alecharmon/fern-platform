import { useCallback, useState } from "react";

import { ANALYTICS_SORT_DIR, ANALYTICS_SORT_FIELDS } from "../constants";

export type SortField = (typeof ANALYTICS_SORT_FIELDS)[keyof typeof ANALYTICS_SORT_FIELDS];
export type SortOrder = (typeof ANALYTICS_SORT_DIR)[keyof typeof ANALYTICS_SORT_DIR];

export interface SortState {
    field: SortField;
    order: SortOrder;
}

interface UseAnalyticsTableOptions {
    defaultSortField?: SortField;
    defaultSortOrder?: SortOrder;
    validSortFields?: SortField[];
}

export function useAnalyticsTable(options: UseAnalyticsTableOptions = {}) {
    const {
        defaultSortField = ANALYTICS_SORT_FIELDS.VISITORS,
        defaultSortOrder = ANALYTICS_SORT_DIR.DESC,
        validSortFields = [ANALYTICS_SORT_FIELDS.VISITORS, ANALYTICS_SORT_FIELDS.VIEWS]
    } = options;

    const [sortState, setSortState] = useState<SortState>({
        field: defaultSortField,
        order: defaultSortOrder
    });

    const handleSort = useCallback(
        (field: string, order: SortOrder) => {
            if (validSortFields.includes(field as SortField)) {
                setSortState({ field: field as SortField, order });
            }
        },
        [validSortFields]
    );

    return { sortState, handleSort };
}

// Common column configurations
export const ANALYTICS_COLUMNS = {
    visitors: {
        key: "visitors",
        label: "Visitors",
        width: "100px",
        sortable: true,
        format: (value: number) => value.toLocaleString()
    },
    views: {
        key: "views",
        label: "Views",
        width: "100px",
        sortable: true,
        format: (value: number) => value.toLocaleString()
    },
    agentViews: {
        key: "agentViews",
        label: "Agent visitors",
        width: "140px",
        sortable: true,
        format: (value: number) => value.toLocaleString()
    },
    humanViews: {
        key: "humanViews",
        label: "Human visitors",
        width: "140px",
        sortable: true,
        format: (value: number) => value.toLocaleString()
    }
};

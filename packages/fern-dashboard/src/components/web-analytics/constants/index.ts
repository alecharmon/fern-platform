export const ANALYTICS_SORT_FIELDS = {
    VISITORS: "visitors",
    VIEWS: "views"
};

export const ANALYTICS_FIELDS = {
    ...ANALYTICS_SORT_FIELDS,
    SESSIONS: "sessions",
    PATH: "path"
};

export const ANALYTICS_SORT_DIR = {
    ASC: "asc",
    DESC: "desc"
};

export const ANALYTICS_TABLES = {
    PATHS: "paths",
    COUNTRIES: "countries"
};

export type AnalyticsField = (typeof ANALYTICS_FIELDS)[keyof typeof ANALYTICS_FIELDS];

export type AnalyticsSortDir = (typeof ANALYTICS_SORT_DIR)[keyof typeof ANALYTICS_SORT_DIR];

export type AnalyticsSortState = {
    field: AnalyticsField;
    order: AnalyticsSortDir;
};

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

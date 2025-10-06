export const ANALYTICS_FIELDS = {
    VISITORS: "visitors",
    VIEWS: "views",
    SESSIONS: "sessions",
    PATH: "path"
};

export const ANALYTICS_SORT_DIR = {
    asc: "asc",
    desc: "desc"
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

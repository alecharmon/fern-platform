import type { FernAI } from "@fern-api/fai-sdk";

export enum TimeRange {
    LAST_WEEK = "LAST_WEEK",
    LAST_MONTH = "LAST_MONTH",
    LAST_YEAR = "LAST_YEAR",
    ALL = "ALL"
}

const getToday = (): string => {
    const date = new Date();
    return date.toISOString();
};

const getLastWeekStart = (): string => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString();
};

const getLastYearStart = (): string => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString();
};

const getLastMonthStart = (): string => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString();
};

export const getRequestParams = (timeRange: TimeRange): FernAI.GetAnalyticsHistogramRequest => {
    const endDate = getToday();

    switch (timeRange) {
        case TimeRange.LAST_WEEK:
            return {
                start_date: getLastWeekStart(),
                end_date: endDate,
                group_by: "DAY"
            };

        case TimeRange.LAST_MONTH:
            return {
                start_date: getLastMonthStart(),
                end_date: endDate,
                group_by: "DAY"
            };

        case TimeRange.LAST_YEAR:
            return {
                start_date: getLastYearStart(),
                end_date: endDate,
                group_by: "MONTH"
            };

        case TimeRange.ALL:
            return {
                start_date: undefined,
                end_date: endDate,
                group_by: "MONTH"
            };
    }
};

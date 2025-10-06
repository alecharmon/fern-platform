/**
 * Analytics Service for PostHog data
 *
 * This service contains business logic for specific analytics queries.
 * It uses the PostHogClient for HTTP communication but handles the
 * construction of queries and processing of results.
 */
import { PostHogClient } from "./client";
import type {
    AnalyticsConfig,
    AnalyticsMetrics,
    DateRangeOptions,
    MetricsOptions,
    TimeSeriesData,
    TimeSeriesOptions
} from "./types";

export class AnalyticsService {
    private readonly config: AnalyticsConfig;
    private readonly client: PostHogClient;

    constructor(config: AnalyticsConfig & { projectId?: string; apiUrl?: string }) {
        this.config = {
            userId: config.userId,
            baseSiteUrl: this.normalizeUrl(config.baseSiteUrl)
        };

        // Create client internally
        const projectId = config.projectId || process.env.POSTHOG_ANALYTICS_PROJECT_ID;
        if (!projectId) {
            throw new Error("POSTHOG_ANALYTICS_PROJECT_ID environment variable is required");
        }

        this.client = new PostHogClient({
            projectId,
            apiUrl: config.apiUrl
        });
    }

    /**
     * Get basic analytics metrics for the site over a time period
     */
    async getMetrics(options: MetricsOptions = {}): Promise<AnalyticsMetrics> {
        const { whereClause } = this.buildDateAndFilterClause(options);

        const query = `
      SELECT 
        uniq(distinct_id) as visitors,
        count(*) as pageviews,
        uniq(properties.$session_id) as sessions
      FROM events 
      WHERE 
        event = '$pageview' 
        AND properties.$host = '${this.config.baseSiteUrl}'
        ${whereClause}
    `;

        const response = await this.client.query<[number, number, number]>(query, {
            name: `metrics-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        const result = response.results[0];
        if (!result) {
            return {
                visitors: 0,
                pageViews: 0,
                sessions: 0
            };
        }

        return {
            visitors: result[0],
            pageViews: result[1],
            sessions: result[2]
        };
    }

    private getSelectAndGroupByClause(
        type: "pageviews" | "visitors",
        groupBy?: number
    ): {
        selectClause: string;
        groupByClause: string;
    } {
        let selectClause: string;
        let groupByClause: string;

        switch (groupBy) {
            case 7:
                selectClause = `toDate(toStartOfWeek(timestamp)) as date, count(*) as ${type}`;
                groupByClause = `GROUP BY toDate(toStartOfWeek(timestamp))`;
                break;
            case 30:
                selectClause = `toDate(toStartOfMonth(timestamp)) as date, count(*) as ${type}`;
                groupByClause = `GROUP BY toDate(toStartOfMonth(timestamp))`;
                break;
            default:
                selectClause = `to_date(timestamp) as date, count(*) as ${type}`;
                groupByClause = `GROUP BY to_date(timestamp)`;
        }

        return { selectClause, groupByClause };
    }

    /**
     * Get time series data for pageviews over a period
     */
    async getPageViewsTimeSeries(options: TimeSeriesOptions = {}): Promise<TimeSeriesData[]> {
        const { groupBy } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);

        const { selectClause, groupByClause } = this.getSelectAndGroupByClause("pageviews", groupBy);

        const query = `
      SELECT ${selectClause}
      FROM events 
      WHERE 
        event = '$pageview' 
        AND properties.$host = '${this.config.baseSiteUrl}'
        ${whereClause}
      ${groupByClause}
      ORDER BY date
    `;

        const response = await this.client.query<[string, number]>(query, {
            name: `timeseries${groupBy ? `-grouped${groupBy}d` : ""}-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        const results = response.results.map((row) => ({
            date: row[0],
            value: row[1]
        }));

        // Adjust first date to show actual data start date instead of period boundary
        // Only needed for last_n_days since weeks/months use clean boundaries
        if (groupBy && results.length > 0 && options.dateRange?.type === "last_n_days") {
            const dateRange = options.dateRange;
            if (dateRange.type === "last_n_days") {
                const requestedStartDate = new Date();
                requestedStartDate.setDate(requestedStartDate.getDate() - dateRange.days);
                const requestedStartDateString = requestedStartDate.toISOString().split("T")[0];
                if (!requestedStartDateString) {
                    throw new Error("Requested start date string is undefined");
                }

                // If the first result is earlier than our requested start date, adjust it
                if (results[0] && results[0].date < requestedStartDateString) {
                    results[0] = { ...results[0], date: requestedStartDateString };
                }
            }
        }

        return results;
    }

    /**
     * Get unique visitors time series over a period
     */
    async getVisitorsTimeSeries(options: TimeSeriesOptions = {}): Promise<TimeSeriesData[]> {
        const { groupBy } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);

        let selectClause: string;
        let groupByClause: string;

        switch (groupBy) {
            case 7:
                selectClause = `toDate(toStartOfWeek(timestamp)) as date, uniq(distinct_id) as visitors`;
                groupByClause = `GROUP BY toDate(toStartOfWeek(timestamp))`;
                break;
            case 30:
                selectClause = `toDate(toStartOfMonth(timestamp)) as date, uniq(distinct_id) as visitors`;
                groupByClause = `GROUP BY toDate(toStartOfMonth(timestamp))`;
                break;
            default:
                selectClause = `to_date(timestamp) as date, uniq(distinct_id) as visitors`;
                groupByClause = `GROUP BY to_date(timestamp)`;
        }

        const query = `
      SELECT ${selectClause}
      FROM events 
      WHERE 
        event = '$pageview' 
        AND properties.$host = '${this.config.baseSiteUrl}'
        ${whereClause}
      ${groupByClause}
      ORDER BY date
    `;

        const response = await this.client.query<[string, number]>(query, {
            name: `visitors-timeseries${groupBy ? `-grouped${groupBy}d` : ""}-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        const results = response.results.map((row) => ({
            date: row[0],
            value: row[1]
        }));

        // Adjust first date to show actual data start date instead of period boundary
        // Only needed for last_n_days since weeks/months use clean boundaries
        if (groupBy && results.length > 0 && options.dateRange?.type === "last_n_days") {
            const dateRange = options.dateRange;
            if (dateRange.type === "last_n_days") {
                const requestedStartDate = new Date();
                requestedStartDate.setDate(requestedStartDate.getDate() - dateRange.days);
                const requestedStartDateString = requestedStartDate.toISOString().split("T")[0];
                if (!requestedStartDateString) {
                    throw new Error("Requested start date string is undefined");
                }
                // If the first result is earlier than our requested start date, adjust it
                if (results[0] && results[0].date < requestedStartDateString) {
                    results[0] = { ...results[0], date: requestedStartDateString };
                }
            }
        }

        return results;
    }
    /**
     * Get top pages by pageviews
     */
    async getTopPages(
        options: TimeSeriesOptions & {
            limit?: number;
            orderBy?: "visitors" | "views";
            order?: "asc" | "desc";
        } = {}
    ): Promise<{ path: string; visitors: number; views: number }[]> {
        const { limit = 10, orderBy = "views", order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);

        const query = `
      SELECT properties.$pathname as path, uniq(distinct_id) as visitors, count(*) as views
      FROM events 
      WHERE 
        event = '$pageview' 
        AND properties.$host = '${this.config.baseSiteUrl}'
        ${whereClause}
      GROUP BY properties.$pathname
      ORDER BY ${orderBy} ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, number, number]>(query, {
            name: `top-pages-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        return response.results.map((row) => ({
            path: row[0] || "/",
            visitors: row[1],
            views: row[2]
        }));
    }

    /**
     * Get top countries by pageviews
     */
    async getTopCountries(
        options: TimeSeriesOptions & {
            limit?: number;
            orderBy?: "visitors" | "views";
            order?: "asc" | "desc";
        } = {}
    ): Promise<{ country: string; visitors: number; views: number }[]> {
        const { limit = 10, orderBy = "visitors", order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);

        const query = `
      SELECT 
        properties.$geoip_country_code as country, 
        uniq(distinct_id) as visitors, 
        count(*) as views
      FROM events 
      WHERE 
        event = '$pageview' 
        AND properties.$host = '${this.config.baseSiteUrl}'
        AND properties.$geoip_country_code IS NOT NULL
        AND properties.$geoip_country_code != ''
        ${whereClause}
      GROUP BY properties.$geoip_country_code
      ORDER BY ${orderBy} ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, number, number]>(query, {
            name: `top-countries-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        return response.results.map((row) => ({
            country: row[0] || "Unknown",
            visitors: row[1],
            views: row[2]
        }));
    }

    /**
     * Get the configuration for this analytics service
     */
    getConfig(): Readonly<AnalyticsConfig> {
        return { ...this.config };
    }

    private normalizeUrl(url: string): string {
        // Remove protocol, trailing slashes, and www prefix for consistent querying
        return url
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .replace(/\/$/, "");
    }

    /**
     * Build date range and filter WHERE clause based on options
     */
    private buildDateAndFilterClause(options: { dateRange?: DateRangeOptions }): {
        whereClause: string;
    } {
        const dateRange = options.dateRange || { type: "last_n_days", days: 7 };

        let dateClause: string;
        if (dateRange.type === "last_n_days") {
            // Keep the exact requested date range - don't extend start date to boundaries
            const startDate = `toStartOfDay(now() - interval ${dateRange.days} day)`;
            const endDate = "now()";

            dateClause = `AND timestamp >= ${startDate} AND timestamp <= ${endDate}`;
        } else if (dateRange.type === "last_n_weeks") {
            // Clean week boundaries: start of first week to end of current week
            const startDate = `toStartOfWeek(now() - interval ${dateRange.weeks} week)`;
            const endDate = "toStartOfWeek(now()) + interval 1 week - interval 1 second";

            dateClause = `AND timestamp >= ${startDate} AND timestamp <= ${endDate}`;
        } else if (dateRange.type === "last_n_months") {
            // Clean month boundaries: start of first month to end of current month
            const startDate = `toStartOfMonth(now() - interval ${dateRange.months} month)`;
            const endDate = "toStartOfMonth(now()) + interval 1 month - interval 1 second";

            dateClause = `AND timestamp >= ${startDate} AND timestamp <= ${endDate}`;
        } else {
            // custom_range
            dateClause = `AND timestamp >= '${dateRange.startDate}' AND timestamp < '${dateRange.endDate}'`;
        }

        return {
            whereClause: dateClause
        };
    }

    /**
     * Generate query name suffix for caching/debugging
     */
    private getQueryNameSuffix(options: { dateRange?: DateRangeOptions }): string {
        const dateRange = options.dateRange || { type: "last_n_days", days: 7 };

        if (dateRange.type === "last_n_days") {
            return `${dateRange.days}d`;
        } else if (dateRange.type === "last_n_weeks") {
            return `${dateRange.weeks}w`;
        } else if (dateRange.type === "last_n_months") {
            return `${dateRange.months}m`;
        } else {
            // custom_range
            return `${dateRange.startDate}-${dateRange.endDate}`;
        }
    }
}

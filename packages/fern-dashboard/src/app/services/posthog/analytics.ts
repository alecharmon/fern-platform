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
    APIExplorerEndpoint,
    APIExplorerOptions,
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
            baseSiteUrl: this.normalizeUrl(config.baseSiteUrl),
            additionalDomains: config.additionalDomains?.map((domain) => this.normalizeUrl(domain))
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
        const hostFilter = this.buildHostFilterClause();

        const query = `
      SELECT 
        uniq(distinct_id) as visitors,
        count(*) as pageviews,
        uniq(properties.$session_id) as sessions
      FROM events 
      WHERE 
        event = '$pageview' 
        AND ${hostFilter}
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
        const hostFilter = this.buildHostFilterClause();

        const { selectClause, groupByClause } = this.getSelectAndGroupByClause("pageviews", groupBy);

        const query = `
      SELECT ${selectClause}
      FROM events 
      WHERE 
        event = '$pageview' 
        AND ${hostFilter}
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
        const hostFilter = this.buildHostFilterClause();

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
        AND ${hostFilter}
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
        const hostFilter = this.buildHostFilterClause();

        const query = `
      SELECT properties.$pathname as path, uniq(distinct_id) as visitors, count(*) as views
      FROM events 
      WHERE 
        event = '$pageview' 
        AND ${hostFilter}
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
        const hostFilter = this.buildHostFilterClause();

        const query = `
      SELECT 
        properties.$geoip_country_code as country, 
        uniq(distinct_id) as visitors, 
        count(*) as views
      FROM events 
      WHERE 
        event = '$pageview' 
        AND ${hostFilter}
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
     * Get traffic by channel type (Direct, Referral, Organic Search, etc.)
     * Uses PostHog's official channel type calculation logic
     */
    async getChannels(
        options: TimeSeriesOptions & {
            limit?: number;
            orderBy?: "visitors" | "views";
            order?: "asc" | "desc";
        } = {}
    ): Promise<{ channel: string; visitors: number; views: number }[]> {
        const { limit = 10, orderBy = "visitors", order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);
        const hostFilter = this.buildHostFilterClause();

        // PostHog's official channel type calculation logic (posthog doesn't seem to offer the channel data directly via HogQL)
        // See: https://posthog.com/docs/data/channel-type
        const query = `
      SELECT 
        CASE
          -- Cross-network (check first as per PostHog docs)
          WHEN properties.utm_campaign = 'cross-network'
               THEN 'Cross-Network'
               
          -- Direct traffic (including null referring domain)
          WHEN (properties.$referring_domain = '$direct' OR properties.$referring_domain IS NULL OR properties.$referring_domain = '')
               AND (properties.utm_medium IS NULL OR properties.utm_medium = '')
               AND (properties.utm_source IS NULL OR properties.utm_source = '' OR properties.utm_source = 'direct' OR properties.utm_source = '(direct)')
               THEN 'Direct'
          
          -- Check if traffic is paid (has utm_medium indicators or gclid/gad_source)
          WHEN properties.utm_medium IN ('cpc', 'cpm', 'cpv', 'cpa', 'ppc', 'retargeting')
               OR properties.utm_medium LIKE 'paid%'
               OR properties.gclid IS NOT NULL
               OR properties.gad_source IS NOT NULL
               THEN
            CASE
              -- Paid Search
              WHEN properties.utm_source IN ('google', 'bing', 'yahoo', 'baidu', 'yandex', 'duckduckgo')
                   OR properties.$referring_domain LIKE '%google.%'
                   OR properties.$referring_domain LIKE '%bing.%'
                   OR properties.$referring_domain LIKE '%yahoo.%'
                   OR properties.$referring_domain LIKE '%baidu.%'
                   OR properties.gad_source = '1'
                   THEN 'Paid Search'
              -- Paid Social
              WHEN properties.utm_source IN ('facebook', 'instagram', 'linkedin', 'twitter', 'pinterest', 'reddit', 'tiktok')
                   OR properties.$referring_domain LIKE '%facebook.%'
                   OR properties.$referring_domain LIKE '%instagram.%'
                   OR properties.$referring_domain LIKE '%linkedin.%'
                   OR properties.$referring_domain LIKE '%twitter.%'
                   OR properties.utm_medium IN ('sm', 'social-media', 'social-network', 'social')
                   THEN 'Paid Social'
              -- Paid Video
              WHEN properties.utm_source IN ('youtube', 'vimeo', 'twitch', 'dailymotion')
                   OR properties.$referring_domain LIKE '%youtube.%'
                   OR properties.$referring_domain LIKE '%vimeo.%'
                   OR properties.$referring_domain LIKE '%twitch.%'
                   OR properties.utm_medium = 'video'
                   OR properties.utm_campaign LIKE '%video%'
                   THEN 'Paid Video'
              -- Paid Shopping
              WHEN properties.utm_source IN ('amazon', 'ebay', 'etsy', 'wish', 'alibaba')
                   OR properties.$referring_domain LIKE '%amazon.%'
                   OR properties.$referring_domain LIKE '%ebay.%'
                   OR properties.$referring_domain LIKE '%etsy.%'
                   OR properties.utm_campaign LIKE '%shop%'
                   OR properties.utm_campaign LIKE '%shopping%'
                   THEN 'Paid Shopping'
              -- Display
              WHEN properties.utm_medium IN ('display', 'cpm', 'banner', 'interstitial')
                   THEN 'Display'
              ELSE 'Paid Unknown'
            END
          
          -- Email (check before organic categories as per PostHog docs)
          WHEN properties.utm_source IN ('email', 'e_mail', 'e-mail', 'mail')
               OR properties.utm_medium IN ('email', 'e_mail', 'e-mail', 'mail')
               OR properties.$referring_domain LIKE '%mail.%'
               OR properties.$referring_domain IN ('mail.google.com', 'outlook.live.com', 'mail.yahoo.com')
               THEN 'Email'
          
          -- SMS
          WHEN properties.utm_source = 'sms'
               OR properties.utm_medium = 'sms'
               THEN 'SMS'
          
          -- Organic Search
          WHEN properties.utm_source IN ('google', 'bing', 'yahoo', 'baidu', 'yandex', 'duckduckgo')
               OR properties.$referring_domain LIKE '%google.%'
               OR properties.$referring_domain LIKE '%bing.%'
               OR properties.$referring_domain LIKE '%yahoo.%'
               OR properties.$referring_domain LIKE '%baidu.%'
               OR properties.$referring_domain LIKE '%duckduckgo.%'
               THEN 'Organic Search'
          
          -- Organic Social
          WHEN properties.utm_source IN ('facebook', 'instagram', 'linkedin', 'twitter', 'pinterest', 'reddit', 'tiktok')
               OR properties.$referring_domain LIKE '%facebook.%'
               OR properties.$referring_domain LIKE '%instagram.%'
               OR properties.$referring_domain LIKE '%linkedin.%'
               OR properties.$referring_domain LIKE '%twitter.%'
               OR properties.$referring_domain LIKE '%reddit.%'
               OR properties.utm_medium IN ('sm', 'social-media', 'social-network', 'social')
               THEN 'Organic Social'
          
          -- Organic Video
          WHEN properties.utm_source IN ('youtube', 'vimeo', 'twitch', 'dailymotion', 'tiktok')
               OR properties.$referring_domain LIKE '%youtube.%'
               OR properties.$referring_domain LIKE '%vimeo.%'
               OR properties.$referring_domain LIKE '%twitch.%'
               OR properties.$referring_domain LIKE '%tiktok.%'
               OR properties.utm_medium = 'video'
               OR properties.utm_campaign LIKE '%video%'
               THEN 'Organic Video'
          
          -- Organic Shopping
          WHEN properties.utm_source IN ('amazon', 'ebay', 'etsy', 'wish', 'alibaba')
               OR properties.$referring_domain LIKE '%amazon.%'
               OR properties.$referring_domain LIKE '%ebay.%'
               OR properties.$referring_domain LIKE '%etsy.%'
               OR properties.utm_campaign LIKE '%shop%'
               OR properties.utm_campaign LIKE '%shopping%'
               THEN 'Organic Shopping'
          
          -- Affiliate
          WHEN properties.utm_medium = 'affiliate'
               THEN 'Affiliate'
          
          -- Referral
          WHEN properties.utm_medium IN ('referral', 'link', 'app')
               OR (properties.$referring_domain IS NOT NULL
                   AND properties.$referring_domain != ''
                   AND properties.$referring_domain != '$direct')
               THEN 'Referral'
          
          -- Push
          WHEN properties.utm_source = 'firebase'
               OR properties.utm_medium IN ('push', 'notification', 'mobile')
               OR properties.utm_medium LIKE '%push'
               THEN 'Push'
          
          -- Audio
          WHEN properties.utm_medium = 'audio'
               THEN 'Audio'
          
          -- Unknown - this might not appear in PostHog UI if they filter it out
          ELSE 'Unknown'
        END as channel,
        uniq(distinct_id) as visitors,
        count(*) as views
      FROM events 
      WHERE 
        event = '$pageview' 
        AND ${hostFilter}
        ${whereClause}
      GROUP BY channel
      ORDER BY ${orderBy} ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, number, number]>(query, {
            name: `channels-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        return response.results.map((row) => ({
            channel: row[0] || "Direct",
            visitors: row[1],
            views: row[2]
        }));
    }

    /**
     * Get top referring domains (excluding direct traffic)
     * Groups by base domain to combine www and non-www variants
     */
    async getReferringDomains(
        options: TimeSeriesOptions & {
            limit?: number;
            orderBy?: "visitors" | "views";
            order?: "asc" | "desc";
        } = {}
    ): Promise<{ domain: string; visitors: number; views: number }[]> {
        const { limit = 10, orderBy = "visitors", order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);
        const hostFilter = this.buildHostFilterClause();

        // Extract root domain (removes all subdomains including www)
        // This regex extracts the last two parts of the domain (e.g., example.com from sub.example.com)
        const query = `
      SELECT 
        if(
          position(properties.$referring_domain, '.') > 0,
          replaceRegexpOne(properties.$referring_domain, '^.*?([^.]+\\\\.[^.]+)$', '\\\\1'),
          properties.$referring_domain
        ) as domain,
        uniq(distinct_id) as visitors,
        count(*) as views
      FROM events 
      WHERE 
        event = '$pageview' 
        AND ${hostFilter}
        AND properties.$referring_domain IS NOT NULL
        AND properties.$referring_domain != ''
        AND properties.$referring_domain != '$direct'
        ${whereClause}
      GROUP BY domain
      ORDER BY ${orderBy} ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, number, number]>(query, {
            name: `referring-domains-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        return response.results.map((row) => ({
            domain: row[0] || "Unknown",
            visitors: row[1],
            views: row[2]
        }));
    }

    /**
     * Get traffic by device type (Desktop, Mobile, Tablet, etc.)
     * Filters out malicious SQL injection attempts and invalid device types
     */
    async getDeviceTypes(
        options: TimeSeriesOptions & {
            limit?: number;
            orderBy?: "visitors" | "views";
            order?: "asc" | "desc";
        } = {}
    ): Promise<{ deviceType: string; visitors: number; views: number }[]> {
        const { limit = 10, orderBy = "visitors", order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);
        const hostFilter = this.buildHostFilterClause();

        // Valid device types to filter for
        // const validDeviceTypes = [
        //     "Desktop",
        //     "Mobile",
        //     "Tablet",
        //     "Console",
        //     "TV",
        //     "Mobile Phone",
        //     "Smart TV",
        //     "Game Console"
        // ];

        const query = `
      SELECT
        properties.$device_type as deviceType,
        uniq(distinct_id) as visitors,
        count(*) as views
      FROM events
      WHERE
        event = '$pageview'
        AND ${hostFilter}
        AND properties.$device_type IS NOT NULL
        AND properties.$device_type != ''
        -- Filter out malicious SQL injection attempts (case-insensitive)
        AND lower(properties.$device_type) NOT LIKE '%sleep%'
        AND lower(properties.$device_type) NOT LIKE '%delay%'
        AND lower(properties.$device_type) NOT LIKE '%xor%'
        AND lower(properties.$device_type) NOT LIKE '%select%'
        AND lower(properties.$device_type) NOT LIKE '%waitfor%'
        AND properties.$device_type NOT LIKE '%;%'
        AND properties.$device_type NOT LIKE '%''%'
        AND properties.$device_type NOT LIKE '%"%'
        AND properties.$device_type NOT LIKE '%(%'
        AND properties.$device_type NOT LIKE '%+%'
        AND properties.$device_type NOT LIKE '%=%'
        -- Only include known valid device types
        AND (
          lower(properties.$device_type) = 'desktop'
          OR lower(properties.$device_type) = 'mobile'
          OR lower(properties.$device_type) = 'mobile phone'
          OR lower(properties.$device_type) = 'tablet'
          OR lower(properties.$device_type) = 'console'
          OR lower(properties.$device_type) = 'game console'
          OR lower(properties.$device_type) = 'tv'
          OR lower(properties.$device_type) = 'smart tv'
        )
        ${whereClause}
      GROUP BY properties.$device_type
      ORDER BY ${orderBy} ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, number, number]>(query, {
            name: `device-types-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        // Normalize device type names to match PostHog UI
        const normalizeDeviceType = (type: string): string | null => {
            const normalized = type.toLowerCase();
            switch (normalized) {
                case "desktop":
                    return "Desktop";
                case "mobile":
                case "mobile phone":
                    return "Mobile";
                case "tablet":
                    return "Tablet";
                case "console":
                case "game console":
                    return "Console";
                case "tv":
                case "smart tv":
                    return "TV";
                default:
                    // Return null for unrecognized device types to filter them out
                    return null;
            }
        };

        return response.results
            .map((row) => {
                const normalized = normalizeDeviceType(row[0] || "");
                if (!normalized) {
                    return null;
                }
                return {
                    deviceType: normalized,
                    visitors: row[1],
                    views: row[2]
                };
            })
            .filter((item): item is { deviceType: string; visitors: number; views: number } => item != null);
    }

    /**
     * Get LLM file views (llms.txt, llms-full.txt, .md files) broken down by agent vs human
     */
    async getLLMFileViews(
        options: TimeSeriesOptions & {
            limit?: number;
            orderBy?: "agentViews" | "humanViews" | "totalViews";
            order?: "asc" | "desc";
        } = {}
    ): Promise<{ path: string; agentViews: number; humanViews: number }[]> {
        const { limit = 20, orderBy = "totalViews", order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);

        // Determine the ORDER BY clause based on the orderBy parameter
        let orderByClause: string;
        if (orderBy === "agentViews") {
            orderByClause = `countIf(properties.possibleBot = true AND properties.userAgent != 'node')`;
        } else if (orderBy === "humanViews") {
            orderByClause = `countIf(properties.possibleBot = false OR properties.userAgent = 'node')`;
        } else {
            // totalViews (default)
            orderByClause = `(countIf(properties.possibleBot = true AND properties.userAgent != 'node') + countIf(properties.possibleBot = false OR properties.userAgent = 'node'))`;
        }

        const domainFilter = this.buildDomainFilterClause();

        const query = `
      SELECT
        properties.path as path,
        countIf(properties.possibleBot = true AND properties.userAgent != 'node') as agentViews,
        countIf(properties.possibleBot = false OR properties.userAgent = 'node') as humanViews
      FROM events
      WHERE
        event = 'static_content_served'
        AND ${domainFilter}
        AND (
          properties.path LIKE '%llms.txt'
          OR properties.path LIKE '%llms-full.txt'
          OR properties.path LIKE '%.md'
        )
        ${whereClause}
      GROUP BY properties.path
      ORDER BY ${orderByClause} ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, number, number]>(query, {
            name: `llm-files-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        return response.results.map((row) => ({
            path: row[0] || "/",
            agentViews: row[1],
            humanViews: row[2]
        }));
    }

    /**
     * Get most common 404 pages by analyzing not_found events
     */
    async get404Pages(
        options: TimeSeriesOptions & {
            limit?: number;
            order?: "asc" | "desc";
        } = {}
    ): Promise<{ path: string; count: number }[]> {
        const { limit = 20, order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);
        const hostFilter = this.buildHostFilterClause();

        const query = `
      SELECT
        properties.pathname as path,
        count(*) as count
      FROM events
      WHERE
        event = 'not_found'
        AND ${hostFilter}
        AND properties.pathname IS NOT NULL
        AND properties.pathname != ''
        ${whereClause}
      GROUP BY properties.pathname
      ORDER BY count ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, number]>(query, {
            name: `404-pages-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        return response.results.map((row) => ({
            path: row[0] || "/",
            count: row[1]
        }));
    }

    /**
     * Get most common API Explorer requests by endpoint and method
     * Returns endpoints with their HTTP methods and call counts
     */
    async getAPIExplorerRequests(options: APIExplorerOptions = {}): Promise<APIExplorerEndpoint[]> {
        const { limit = 100, host, order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);

        const hostOnly = this.getHostOnly();
        const pathPrefix = this.getPathPrefix();

        let hostFilter: string;
        if (host) {
            hostFilter = `properties.$host = '${host}'`;
        } else if (pathPrefix) {
            hostFilter = `(properties.$host = '${hostOnly}' OR properties.$host = 'www.${hostOnly}') AND properties.$pathname LIKE '${pathPrefix}%'`;
        } else {
            hostFilter = `(properties.$host = '${this.config.baseSiteUrl}' OR properties.$host = 'www.${this.config.baseSiteUrl}')`;
        }

        const query = `
      SELECT
        properties.$host as host,
        properties.method as method,
        properties.endpointRoute as endpoint,
        properties.endpointName as name,
        COUNT(*) as count,
        any(properties.$current_url) as currentUrl
      FROM events
      WHERE
        event = 'api_playground_request_sent'
        AND ${hostFilter}
        AND properties.method IS NOT NULL
        AND properties.endpointRoute IS NOT NULL
        ${whereClause}
      GROUP BY
        properties.$host,
        properties.method,
        properties.endpointRoute,
        properties.endpointName
      ORDER BY
        count ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, string, string, string, number, string]>(query, {
            name: `api-explorer-requests-${this.getQueryNameSuffix(options)}-${host || this.config.baseSiteUrl}`
        });

        return response.results.map((row) => ({
            host: row[0] || "",
            method: row[1] || "",
            endpoint: row[2] || "",
            name: row[3] || "",
            count: row[4],
            currentUrl: row[5] || ""
        }));
    }

    /**
     * Get feedback submissions from PostHog with pagination support
     */
    async getFeedback(
        options: TimeSeriesOptions & {
            limit?: number;
            offset?: number;
            feedbackType?: "page" | "code_block" | "all";
        } = {}
    ): Promise<
        {
            date: string;
            location: string;
            wasHelpful: boolean;
            selection: string;
            currentUrl: string;
            device: string;
            browser: string;
            operatingSystem: string;
            userFeedback: string;
            feedbackType?: string;
            language?: string;
            code?: string;
        }[]
    > {
        const { limit = 100, offset = 0, feedbackType = "all" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);
        const hostFilter = this.buildHostFilterClause();

        const pageFeedbackQuery = `
      SELECT
        to_date(timestamp) as date,
        CONCAT(
          COALESCE(properties.$geoip_city_name, ''),
          CASE
            WHEN properties.$geoip_city_name IS NOT NULL AND properties.$geoip_country_name IS NOT NULL
            THEN ' '
            ELSE ''
          END,
          COALESCE(properties.$geoip_country_name, 'Unknown')
        ) as location,
        properties.satisfied as was_helpful,
        COALESCE(properties.feedback, 'N/A') as selection,
        COALESCE(properties.$current_url, '') as current_url,
        CASE
          WHEN properties.$device_type = 'Mobile' THEN 'Mobile'
          WHEN properties.$device_type = 'Tablet' THEN 'Tablet'
          WHEN properties.$device_type = 'Desktop' THEN 'Desktop'
          ELSE 'Unknown'
        END as device,
        COALESCE(properties.$browser, 'Unknown') as browser,
        COALESCE(properties.$os, 'Unknown') as os,
        COALESCE(properties.message, '') as user_feedback,
        'page' as feedback_type,
        '' as language,
        '' as code,
        timestamp
      FROM events
      WHERE
        event = 'feedback_submitted'
        AND ${hostFilter}
        ${whereClause}
    `;

        const codeBlockFeedbackQuery = `
      SELECT
        to_date(timestamp) as date,
        CONCAT(
          COALESCE(properties.$geoip_city_name, ''),
          CASE
            WHEN properties.$geoip_city_name IS NOT NULL AND properties.$geoip_country_name IS NOT NULL
            THEN ' '
            ELSE ''
          END,
          COALESCE(properties.$geoip_country_name, 'Unknown')
        ) as location,
        false as was_helpful,
        'Code Block Issue' as selection,
        COALESCE(properties.$current_url, '') as current_url,
        CASE
          WHEN properties.$device_type = 'Mobile' THEN 'Mobile'
          WHEN properties.$device_type = 'Tablet' THEN 'Tablet'
          WHEN properties.$device_type = 'Desktop' THEN 'Desktop'
          ELSE 'Unknown'
        END as device,
        COALESCE(properties.$browser, 'Unknown') as browser,
        COALESCE(properties.$os, 'Unknown') as os,
        COALESCE(properties.message, '') as user_feedback,
        'code_block' as feedback_type,
        COALESCE(properties.language, 'Unknown') as language,
        COALESCE(properties.code, '') as code,
        timestamp
      FROM events
      WHERE
        event = 'code_block_feedback_submitted'
        AND ${hostFilter}
        ${whereClause}
    `;

        let finalQuery: string;
        let queryNameSuffix: string;

        if (feedbackType === "page") {
            finalQuery = `
        SELECT * FROM (
          ${pageFeedbackQuery}
        )
        ORDER BY timestamp DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
            queryNameSuffix = `feedback-page-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`;
        } else if (feedbackType === "code_block") {
            finalQuery = `
        SELECT * FROM (
          ${codeBlockFeedbackQuery}
        )
        ORDER BY timestamp DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
            queryNameSuffix = `feedback-code-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`;
        } else {
            finalQuery = `
        SELECT * FROM (
          ${pageFeedbackQuery}
          UNION ALL
          ${codeBlockFeedbackQuery}
        )
        ORDER BY timestamp DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
            queryNameSuffix = `feedback-all-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`;
        }

        const response = await this.client.query<
            [string, string, boolean, string, string, string, string, string, string, string, string, string, string]
        >(finalQuery, {
            name: queryNameSuffix
        });

        return response.results.map((row) => ({
            date: row[0],
            location: row[1],
            wasHelpful: row[2],
            selection: row[3],
            currentUrl: row[4],
            device: row[5],
            browser: row[6],
            operatingSystem: row[7],
            userFeedback: row[8],
            feedbackType: row[9],
            language: row[10],
            code: row[11]
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
     * Build host filter clause that includes all domains (baseSiteUrl + additionalDomains)
     */
    private buildHostFilterClause(): string {
        const allDomains = [this.config.baseSiteUrl];
        if (this.config.additionalDomains && this.config.additionalDomains.length > 0) {
            allDomains.push(...this.config.additionalDomains);
        }

        const conditions = allDomains.flatMap((domain) => {
            const slashIndex = domain.indexOf("/");
            if (slashIndex !== -1) {
                const host = domain.substring(0, slashIndex);
                const pathPrefix = domain.substring(slashIndex);
                return [
                    `(properties.$host = '${host}' AND properties.$pathname LIKE '${pathPrefix}%')`,
                    `(properties.$host = 'www.${host}' AND properties.$pathname LIKE '${pathPrefix}%')`
                ];
            }
            return [`properties.$host = '${domain}'`, `properties.$host = 'www.${domain}'`];
        });

        return `(${conditions.join(" OR ")})`;
    }

    private buildDomainFilterClause(): string {
        const allDomains = [this.config.baseSiteUrl];
        if (this.config.additionalDomains && this.config.additionalDomains.length > 0) {
            allDomains.push(...this.config.additionalDomains);
        }

        const conditions = allDomains.flatMap((domain) => {
            const slashIndex = domain.indexOf("/");
            if (slashIndex !== -1) {
                const host = domain.substring(0, slashIndex);
                const pathPrefix = domain.substring(slashIndex);
                return [
                    `(properties.domain = '${host}' AND properties.path LIKE '${pathPrefix}%')`,
                    `(properties.domain = 'www.${host}' AND properties.path LIKE '${pathPrefix}%')`
                ];
            }
            return [`properties.domain = '${domain}'`, `properties.domain = 'www.${domain}'`];
        });

        return `(${conditions.join(" OR ")})`;
    }

    private getHostOnly(): string {
        const slashIndex = this.config.baseSiteUrl.indexOf("/");
        return slashIndex !== -1 ? this.config.baseSiteUrl.substring(0, slashIndex) : this.config.baseSiteUrl;
    }

    private getPathPrefix(): string | null {
        const slashIndex = this.config.baseSiteUrl.indexOf("/");
        return slashIndex !== -1 ? this.config.baseSiteUrl.substring(slashIndex) : null;
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
            const startDate = `toStartOfDay(now() - interval ${dateRange.days} day)`;
            dateClause = `AND timestamp >= ${startDate} AND timestamp < now()`;
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
     * Get LLM bot traffic by provider type
     */
    async getLLMBotTrafficByProvider(
        options: TimeSeriesOptions & {
            limit?: number;
            order?: "asc" | "desc";
        } = {}
    ): Promise<{ provider: string; count: number }[]> {
        const { limit = 20, order = "desc" } = options;
        const { whereClause } = this.buildDateAndFilterClause(options);
        const domainFilter = this.buildDomainFilterClause();

        const query = `
      SELECT
        CASE
          WHEN properties.userAgent LIKE '%chatgpt%' OR properties.userAgent LIKE '%openai%' THEN 'ChatGPT/OpenAI'
          WHEN properties.userAgent LIKE '%googlebot%' OR properties.userAgent LIKE '%google-extended%' THEN 'GoogleBot/Bard'
          WHEN properties.userAgent LIKE '%bingbot%' OR properties.userAgent LIKE '%msnbot%' THEN 'BingBot/Copilot'
          WHEN properties.userAgent LIKE '%axios%' OR properties.userAgent LIKE '%claude%' OR properties.userAgent LIKE '%anthropic%' THEN 'Claude/Anthropic'
          WHEN properties.userAgent LIKE '%perplexity%' THEN 'Perplexity'
          WHEN properties.userAgent LIKE '%cohere%' THEN 'Cohere'
          ELSE 'Other Bot/Crawler'
        END as provider,
        count(*) as count
      FROM events
      WHERE
        event = 'static_content_served'
        AND ${domainFilter}
        AND properties.domain != 'preview.ferndocs.com'
        AND (properties.possibleBot = true OR properties.possibleBot = 1)
        ${whereClause}
      GROUP BY provider
      ORDER BY count ${order.toUpperCase()}
      LIMIT ${limit}
    `;

        const response = await this.client.query<[string, number]>(query, {
            name: `llm-bot-providers-${this.getQueryNameSuffix(options)}-${this.config.baseSiteUrl}`
        });

        return response.results.map((row) => ({
            provider: row[0] || "Unknown",
            count: row[1]
        }));
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

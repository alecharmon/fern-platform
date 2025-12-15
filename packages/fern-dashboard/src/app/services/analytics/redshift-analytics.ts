import type { DateRangePeriod } from "../analyticsCron/types";
import { getRedshiftPool } from "./redshift-client";

export interface RedshiftDateRange {
    startDate: Date;
    endDate: Date;
}

/**
 * Convert period (days) to date range
 */
export function periodToDateRange(period: DateRangePeriod): RedshiftDateRange {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    return { startDate, endDate };
}

/**
 * Redshift Analytics Client
 * Queries PostHog events from Redshift instead of PostHog API
 * No rate limits - direct database queries!
 */
export class RedshiftAnalytics {
    constructor(private domain: string) {}

    /**
     * Get top pages by pageviews
     */
    async getTopPages(options: {
        dateRange: RedshiftDateRange;
        limit: number;
    }): Promise<Array<{ path: string; visitors: number; views: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        const query = `
            SELECT
                properties."$pathname"::VARCHAR as path,
                COUNT(DISTINCT distinct_id) as visitors,
                COUNT(*) as views
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
            GROUP BY properties."$pathname"::VARCHAR
            ORDER BY views DESC
            LIMIT $5
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString(),
            options.limit
        ]);

        return result.rows.map((row) => ({
            path: row.path || "/",
            visitors: parseInt(row.visitors) || 0,
            views: parseInt(row.views) || 0
        }));
    }

    /**
     * Get top countries by visitors
     */
    async getTopCountries(options: {
        dateRange: RedshiftDateRange;
        limit: number;
    }): Promise<Array<{ country: string; visitors: number; views: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        const query = `
            SELECT
                properties."$geoip_country_code"::VARCHAR as country,
                COUNT(DISTINCT distinct_id) as visitors,
                COUNT(*) as views
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
                AND properties."$geoip_country_code" IS NOT NULL
            GROUP BY properties."$geoip_country_code"::VARCHAR
            ORDER BY visitors DESC
            LIMIT $5
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString(),
            options.limit
        ]);

        return result.rows.map((row) => ({
            country: row.country,
            visitors: parseInt(row.visitors) || 0,
            views: parseInt(row.views) || 0
        }));
    }

    /**
     * Get traffic channels (referrer sources)
     */
    async getChannels(options: {
        dateRange: RedshiftDateRange;
        limit: number;
    }): Promise<Array<{ channel: string; visitors: number; views: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        const query = `
            SELECT
                CASE
                    WHEN properties."$referring_domain"::VARCHAR IS NULL OR properties."$referring_domain"::VARCHAR = '' THEN 'Direct'
                    WHEN properties."$referring_domain"::VARCHAR LIKE '%google%' THEN 'Google'
                    WHEN properties."$referring_domain"::VARCHAR LIKE '%bing%' THEN 'Bing'
                    WHEN properties."$referring_domain"::VARCHAR LIKE '%facebook%' THEN 'Facebook'
                    WHEN properties."$referring_domain"::VARCHAR LIKE '%twitter%' OR properties."$referring_domain"::VARCHAR LIKE '%t.co%' THEN 'Twitter'
                    WHEN properties."$referring_domain"::VARCHAR LIKE '%linkedin%' THEN 'LinkedIn'
                    ELSE properties."$referring_domain"::VARCHAR
                END as channel,
                COUNT(DISTINCT distinct_id) as visitors,
                COUNT(*) as views
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
            GROUP BY channel
            ORDER BY visitors DESC
            LIMIT $5
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString(),
            options.limit
        ]);

        return result.rows.map((row) => ({
            channel: row.channel || "Unknown",
            visitors: parseInt(row.visitors) || 0,
            views: parseInt(row.views) || 0
        }));
    }

    /**
     * Get device types
     */
    async getDeviceTypes(options: {
        dateRange: RedshiftDateRange;
        limit: number;
    }): Promise<Array<{ device: string; visitors: number; views: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        const query = `
            SELECT
                COALESCE(properties."$device_type"::VARCHAR, 'Unknown') as device,
                COUNT(DISTINCT distinct_id) as visitors,
                COUNT(*) as views
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
            GROUP BY device
            ORDER BY visitors DESC
            LIMIT $5
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString(),
            options.limit
        ]);

        return result.rows.map((row) => ({
            device: row.device,
            visitors: parseInt(row.visitors) || 0,
            views: parseInt(row.views) || 0
        }));
    }

    /**
     * Get referring domains
     */
    async getReferringDomains(options: {
        dateRange: RedshiftDateRange;
        limit: number;
    }): Promise<Array<{ domain: string; visitors: number; views: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        const query = `
            SELECT
                properties."$referring_domain"::VARCHAR as domain,
                COUNT(DISTINCT distinct_id) as visitors,
                COUNT(*) as views
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
                AND properties."$referring_domain" IS NOT NULL
                AND properties."$referring_domain"::VARCHAR != ''
            GROUP BY properties."$referring_domain"::VARCHAR
            ORDER BY visitors DESC
            LIMIT $5
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString(),
            options.limit
        ]);

        return result.rows.map((row) => ({
            domain: row.domain,
            visitors: parseInt(row.visitors) || 0,
            views: parseInt(row.views) || 0
        }));
    }

    /**
     * Get overall metrics (pageviews, visitors, sessions)
     */
    async getMetrics(options: { dateRange: RedshiftDateRange }): Promise<{
        pageviews: number;
        visitors: number;
        sessions: number;
    }> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        const query = `
            SELECT
                COUNT(*) as pageviews,
                COUNT(DISTINCT distinct_id) as visitors,
                COUNT(DISTINCT properties."$session_id"::VARCHAR) as sessions
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString()
        ]);

        const row = result.rows[0];
        return {
            pageviews: parseInt(row?.pageviews) || 0,
            visitors: parseInt(row?.visitors) || 0,
            sessions: parseInt(row?.sessions) || 0
        };
    }

    /**
     * Get pageviews time series
     */
    async getPageViewsTimeSeries(options: {
        dateRange: RedshiftDateRange;
    }): Promise<Array<{ date: string; count: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        const query = `
            SELECT
                DATE(timestamp) as date,
                COUNT(*) as count
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
            GROUP BY DATE(timestamp)
            ORDER BY date
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString()
        ]);

        return result.rows.map((row) => ({
            date: row.date.toISOString().split("T")[0],
            count: parseInt(row.count) || 0
        }));
    }

    /**
     * Get visitors time series
     */
    async getVisitorsTimeSeries(options: {
        dateRange: RedshiftDateRange;
    }): Promise<Array<{ date: string; count: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        const query = `
            SELECT
                DATE(timestamp) as date,
                COUNT(DISTINCT distinct_id) as count
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
            GROUP BY DATE(timestamp)
            ORDER BY date
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString()
        ]);

        return result.rows.map((row) => ({
            date: row.date.toISOString().split("T")[0],
            count: parseInt(row.count) || 0
        }));
    }

    /**
     * Get LLM file views (llms.txt, llms-full.txt, markdown access)
     * Separates agent views vs human views using possibleBot property
     * Note: Fetches raw events and processes in TypeScript due to Redshift SUPER column limitations
     */
    async getLLMFileViews(options: {
        dateRange: RedshiftDateRange;
        limit: number;
    }): Promise<Array<{ file: string; agentViews: number; humanViews: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        // Fetch all relevant static_content_served events
        const query = `
            SELECT properties
            FROM posthog.events
            WHERE
                event = 'static_content_served'
                AND (
                    properties."domain"::VARCHAR = $1
                    OR properties."domain"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
                AND (
                    properties."path"::VARCHAR LIKE '%llms.txt'
                    OR properties."path"::VARCHAR LIKE '%llms-full.txt'
                    OR properties."path"::VARCHAR LIKE '%.md'
                )
                AND properties."path" IS NOT NULL
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString()
        ]);

        // Process events in JavaScript to handle possibleBot boolean
        const fileCounts = new Map<string, { agentViews: number; humanViews: number }>();

        for (const row of result.rows) {
            // Parse the SUPER column JSON
            const props = typeof row.properties === "string" ? JSON.parse(row.properties) : row.properties;

            const file = props.path;
            if (!file) {
                continue;
            }

            const userAgent = (props.userAgent || "").toLowerCase();
            const possibleBot = props.possibleBot === true;

            // Determine if this is an agent or human view
            // Agent view: possibleBot=true AND not a node user agent
            // Human view: possibleBot=false OR node user agent (internal monitoring)
            const isAgentView = possibleBot && !userAgent.includes("node");
            const isHumanView = !possibleBot || userAgent.includes("node");

            // Get or initialize counts for this file
            const counts = fileCounts.get(file) || { agentViews: 0, humanViews: 0 };

            if (isAgentView) {
                counts.agentViews++;
            }
            if (isHumanView) {
                counts.humanViews++;
            }

            fileCounts.set(file, counts);
        }

        // Convert to array, sort by total views, and limit
        const results = Array.from(fileCounts.entries())
            .map(([file, counts]) => ({
                file,
                agentViews: counts.agentViews,
                humanViews: counts.humanViews
            }))
            .sort((a, b) => b.agentViews + b.humanViews - (a.agentViews + a.humanViews))
            .slice(0, options.limit);

        return results;
    }

    /**
     * Get API Explorer requests by endpoint
     */
    async getAPIExplorerRequests(options: {
        dateRange: RedshiftDateRange;
        limit: number;
    }): Promise<Array<{ method: string; endpoint: string; name: string; requests: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        // Fetch raw events and parse in TypeScript (Redshift SUPER column limitations)
        const query = `
            SELECT
                JSON_SERIALIZE(properties) as props_json
            FROM posthog.events
            WHERE
                event = 'api_playground_request_sent'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
            LIMIT 10000
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString()
        ]);

        // Parse and aggregate in TypeScript
        const counts = new Map<string, { method: string; endpoint: string; name: string; count: number }>();

        for (const row of result.rows) {
            const props = JSON.parse(row.props_json);
            const method = props.method || "";
            const endpointRoute = props.endpointRoute || "";
            const endpointName = props.endpointName || "";

            const key = `${method}|${endpointRoute}|${endpointName}`;
            const existing = counts.get(key) || { method, endpoint: endpointRoute, name: endpointName, count: 0 };
            existing.count++;
            counts.set(key, existing);
        }

        // Sort by count and limit
        return Array.from(counts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, options.limit)
            .map((item) => ({
                method: item.method,
                endpoint: item.endpoint || "Unknown", // Use endpointRoute (path)
                name: item.name || item.endpoint || "", // Use endpointName (description)
                requests: item.count
            }));
    }

    /**
     * Get LLM bot traffic by provider (from static_content_served events)
     * Note: Fetches raw events and filters in TypeScript due to Redshift SUPER column limitations
     */
    async getLLMBotTrafficByProvider(options: {
        dateRange: RedshiftDateRange;
        limit: number;
    }): Promise<Array<{ provider: string; requests: number }>> {
        const pool = getRedshiftPool();
        const { startDate, endDate } = options.dateRange;

        // Fetch all static_content_served events for markdown/llms.txt
        // Note: We cannot reliably filter bots in SQL because:
        // 1. possibleBot boolean can't be accessed in Redshift SUPER columns via SQL casting
        // 2. Many bots don't have "bot" in userAgent (e.g., "python-httpx", "axios", "ChatGPT-User")
        // So we fetch all events and filter in JavaScript
        const query = `
            SELECT properties
            FROM posthog.events
            WHERE
                event = 'static_content_served'
                AND (
                    properties."domain"::VARCHAR = $1
                    OR properties."domain"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
        `;

        const result = await pool.query(query, [
            this.domain,
            `www.${this.domain}`,
            startDate.toISOString(),
            endDate.toISOString()
        ]);

        // Parse properties and filter/categorize in JavaScript
        const providerCounts = new Map<string, number>();

        for (const row of result.rows) {
            // Parse the SUPER column JSON
            const props = typeof row.properties === "string" ? JSON.parse(row.properties) : row.properties;

            // Filter by staticContentType
            const contentType = props.staticContentType;
            if (contentType !== "markdown" && contentType !== "llms.txt" && contentType !== "llms-full.txt") {
                continue;
            }

            // Check if it's a bot (userAgent patterns or possibleBot flag)
            const userAgent = (props.userAgent || "").toLowerCase();
            const possibleBot = props.possibleBot === true;

            // Determine provider based on user agent
            let provider = "Unknown";

            if (userAgent.includes("googlebot") || userAgent.includes("google-extended")) {
                provider = "Googlebot";
            } else if (userAgent.includes("gptbot") || userAgent.includes("chatgpt")) {
                provider = "OpenAI (GPTBot)";
            } else if (userAgent.includes("claude") || userAgent.includes("anthropic")) {
                provider = "Anthropic (Claude)";
            } else if (userAgent.includes("bingbot") || userAgent.includes("msnbot")) {
                provider = "Microsoft (Bingbot)";
            } else if (userAgent.includes("perplexity")) {
                provider = "Perplexity";
            } else if (userAgent.includes("cohere")) {
                provider = "Cohere";
            } else if (userAgent.includes("slackbot")) {
                provider = "Slack";
            } else if (userAgent.includes("facebookbot") || userAgent.includes("meta")) {
                provider = "Meta";
            } else if (userAgent.includes("amazonbot")) {
                provider = "Amazon";
            } else if (userAgent.includes("baiduspider")) {
                provider = "Baidu";
            } else if (userAgent.includes("yandexbot")) {
                provider = "Yandex";
            } else if (userAgent.includes("duckduckbot")) {
                provider = "DuckDuckGo";
            } else if (userAgent.includes("applebot")) {
                provider = "Apple";
            } else if (
                possibleBot ||
                userAgent.includes("bot") ||
                userAgent.includes("crawler") ||
                userAgent.includes("spider")
            ) {
                provider = "Other Bot";
            }

            // Increment count
            providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
        }

        // Convert to array and sort by count
        const results = Array.from(providerCounts.entries())
            .map(([provider, requests]) => ({ provider, requests }))
            .sort((a, b) => b.requests - a.requests)
            .slice(0, options.limit);

        return results;
    }
}

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

async function testAPIExplorerRedshift() {
    const domain = process.argv[2] || "buildwithfern.com";
    const pool = getRedshiftPool();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log("Testing API Explorer Redshift queries for:", domain);
    console.log("Date range:", startDate.toISOString(), "to", endDate.toISOString());
    console.log("\n");

    try {
        // Check event counts
        console.log("=== Event Counts ===");

        const sentCountQuery = `
            SELECT COUNT(*) as count
            FROM posthog.events
            WHERE
                event = 'api_playground_request_sent'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
        `;

        const receivedCountQuery = `
            SELECT COUNT(*) as count
            FROM posthog.events
            WHERE
                event = 'api_playground_request_received'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
        `;

        const [sentCountResult, receivedCountResult] = await Promise.all([
            pool.query(sentCountQuery, [domain, `www.${domain}`, startDate.toISOString(), endDate.toISOString()]),
            pool.query(receivedCountQuery, [domain, `www.${domain}`, startDate.toISOString(), endDate.toISOString()])
        ]);

        const sentCount = parseInt(sentCountResult.rows[0].count);
        const receivedCount = parseInt(receivedCountResult.rows[0].count);
        console.log(`api_playground_request_sent: ${sentCount} events`);
        console.log(`api_playground_request_received: ${receivedCount} events`);
        console.log(
            `Missing received events: ${sentCount - receivedCount} (${(((sentCount - receivedCount) / sentCount) * 100).toFixed(1)}%)`
        );

        // Check response status distribution in received events
        console.log("\n=== Response Status Distribution ===");
        const statusQuery = `
            SELECT
                JSON_SERIALIZE(properties) as props_json
            FROM posthog.events
            WHERE
                event = 'api_playground_request_received'
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
                AND timestamp >= $3
                AND timestamp < $4
        `;

        const statusResult = await pool.query(statusQuery, [
            domain,
            `www.${domain}`,
            startDate.toISOString(),
            endDate.toISOString()
        ]);

        const statusCounts: Record<string, number> = {};
        for (const row of statusResult.rows) {
            const props = JSON.parse(row.props_json);
            const status = props.responseStatus;
            const statusRange =
                status >= 500 ? "5xx" : status >= 400 ? "4xx" : status >= 300 ? "3xx" : status >= 200 ? "2xx" : "other";
            statusCounts[statusRange] = (statusCounts[statusRange] || 0) + 1;
        }

        console.log("Status code distribution:");
        Object.entries(statusCounts).forEach(([range, count]) => {
            console.log(`  ${range}: ${count} (${((count / receivedCount) * 100).toFixed(1)}%)`);
        });

        // Run actual aggregation
        console.log("\n=== Running Aggregation ===");

        // Common WHERE clause (identical for both queries)
        const commonWhereClause = `
            (
                properties."$host"::VARCHAR = $1
                OR properties."$host"::VARCHAR = $2
            )
            AND timestamp >= $3
            AND timestamp < $4
        `;

        const sentQuery = `
            SELECT JSON_SERIALIZE(properties) as props_json
            FROM posthog.events
            WHERE
                event = 'api_playground_request_sent'
                AND ${commonWhereClause}
        `;

        const receivedQuery = `
            SELECT JSON_SERIALIZE(properties) as props_json
            FROM posthog.events
            WHERE
                event = 'api_playground_request_received'
                AND ${commonWhereClause}
        `;

        const [sentResult, receivedResult] = await Promise.all([
            pool.query(sentQuery, [domain, `www.${domain}`, startDate.toISOString(), endDate.toISOString()]),
            pool.query(receivedQuery, [domain, `www.${domain}`, startDate.toISOString(), endDate.toISOString()])
        ]);

        // Build docsRoute mapping
        const docsRouteToEndpoint = new Map<string, { endpointRoute: string; endpointName: string; method: string }>();
        for (const row of sentResult.rows) {
            const props = JSON.parse(row.props_json);
            const docsRoute = props.docsRoute || "";
            const endpointRoute = props.endpointRoute || "";
            const endpointName = props.endpointName || "";
            const method = props.method || "";
            if (docsRoute) {
                docsRouteToEndpoint.set(docsRoute, { endpointRoute, endpointName, method });
            }
        }

        // Aggregate by endpointRoute
        const counts = new Map<
            string,
            { method: string; endpoint: string; name: string; count: number; numSuccesses: number; numFailures: number }
        >();

        for (const row of sentResult.rows) {
            const props = JSON.parse(row.props_json);
            const method = props.method || "";
            const endpointRoute = props.endpointRoute || "";
            const endpointName = props.endpointName || "";

            const key = `${method}|${endpointRoute}|${endpointName}`;
            const existing = counts.get(key) || {
                method,
                endpoint: endpointRoute,
                name: endpointName,
                count: 0,
                numSuccesses: 0,
                numFailures: 0
            };
            existing.count++;
            counts.set(key, existing);
        }

        // Add status codes from received events
        for (const row of receivedResult.rows) {
            const props = JSON.parse(row.props_json);
            const docsRoute = props.docsRoute || "";
            const responseStatus = props.responseStatus;

            const mappedEndpoint = docsRouteToEndpoint.get(docsRoute);
            if (!mappedEndpoint) {
                continue;
            }

            const key = `${mappedEndpoint.method}|${mappedEndpoint.endpointRoute}|${mappedEndpoint.endpointName}`;
            const existing = counts.get(key);

            if (existing) {
                if (responseStatus >= 200 && responseStatus < 300) {
                    existing.numSuccesses++;
                } else if (responseStatus >= 400) {
                    existing.numFailures++;
                }
            }
        }

        // Show top endpoints
        console.log("\n=== Top 10 Endpoints ===");
        const sorted = Array.from(counts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        sorted.forEach((data, idx) => {
            const unaccounted = data.count - data.numSuccesses - data.numFailures;
            const unaccountedPct = ((unaccounted / data.count) * 100).toFixed(1);
            console.log(`\n${idx + 1}. ${data.method} ${data.endpoint || data.name}`);
            console.log(`   Total: ${data.count}`);
            console.log(`   Successes (2xx): ${data.numSuccesses}`);
            console.log(`   Failures (4xx/5xx): ${data.numFailures}`);
            console.log(`   Unaccounted (missing/3xx): ${unaccounted} (${unaccountedPct}%)`);
        });

        // Summary
        console.log("\n=== SUMMARY ===");
        const totalRequests = Array.from(counts.values()).reduce((sum, d) => sum + d.count, 0);
        const totalSuccesses = Array.from(counts.values()).reduce((sum, d) => sum + d.numSuccesses, 0);
        const totalFailures = Array.from(counts.values()).reduce((sum, d) => sum + d.numFailures, 0);
        const totalUnaccounted = totalRequests - totalSuccesses - totalFailures;

        console.log(`Total requests (sent): ${totalRequests}`);
        console.log(
            `Total successes (2xx): ${totalSuccesses} (${((totalSuccesses / totalRequests) * 100).toFixed(1)}%)`
        );
        console.log(
            `Total failures (4xx/5xx): ${totalFailures} (${((totalFailures / totalRequests) * 100).toFixed(1)}%)`
        );
        console.log(
            `Total unaccounted: ${totalUnaccounted} (${((totalUnaccounted / totalRequests) * 100).toFixed(1)}%)`
        );
        console.log(`\nPossible reasons for unaccounted requests:`);
        console.log(`  - Request timeout (no response received)`);
        console.log(`  - Network error (no response received)`);
        console.log(`  - 3xx redirects (not counted as success or failure)`);
        console.log(`  - 1xx informational responses`);
        console.log(`  - Response not logged to PostHog`);

        await pool.end();
        console.log("\n✓ Test completed!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        await pool.end();
        process.exit(1);
    }
}

testAPIExplorerRedshift();

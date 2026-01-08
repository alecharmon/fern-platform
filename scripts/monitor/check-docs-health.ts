#!/usr/bin/env node
/* eslint-disable no-console */

export {};

/**
 * Comprehensive health monitoring script for Fern documentation sites
 *
 * This script checks:
 * 1. /sitemap.xml - should return valid XML
 * 2. /api/fern-docs/whoami - should return unauthenticated response
 * 3. / (home page) - should be accessible (follows redirects)
 * 4. llms.txt - LLM-friendly docs endpoint
 * 5. llms-full.txt - Full LLM-friendly docs endpoint
 * 6. .md/.mdx links from llms.txt - validates linked markdown files
 *
 * On failure:
 * - Sends alerts to Slack tagging docs-on-call
 * - Creates a single incident in incident.io with all failing sites
 * - Auto-resolves incident when all endpoints recover
 */

interface MonitoredSite {
    domain: string;
    name: string;
    basePath?: string;
}

interface CheckResult {
    site: MonitoredSite;
    endpoint: string;
    success: boolean;
    error?: string;
    statusCode?: number;
    responseTime?: number;
}

const MONITORED_SITES: MonitoredSite[] = [
    { domain: "elevenlabs.io", basePath: "/docs", name: "ElevenLabs" },
    { domain: "buildwithfern.com", basePath: "/learn", name: "Fern Docs" },
    { domain: "docs.vapi.ai", name: "Vapi" },
    { domain: "docs.cohere.com", name: "Cohere" }
];

const TIMEOUT_MS = 60000;
const MAX_RETRIES = 5;

// incident.io status IDs
const INCIDENT_STATUS_MONITORING = "01HR85VFNXWH1H6976YCEJ5XJB";
const INCIDENT_STATUS_CANCELED = "01HR85VFNXMV8SBQ3FRPMDBCST";
const TERMINAL_INCIDENT_STATES = ["declined", "merged", "canceled", "learning", "closed"];

// Severity IDs - adjust based on your incident.io configuration
const INCIDENT_SEVERITY_MINOR = "01HR85VFNX9NYZG6B5Z40K8Y9V";
const INCIDENT_SEVERITY_MAJOR = "01HR85VFNXR6H5YPKJTE79YHG4";
const INCIDENT_SEVERITY_CRITICAL = "01HR85VFNXA1RTYRR744G9FN6J";

// Number of core checks per site (sitemap, whoami, homepage, llms.txt, llms-full.txt)
const CORE_CHECKS_PER_SITE = 5;

const INCIDENT_NAME_PREFIX = "Docs health check failing";

function isDryRun(): boolean {
    return process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
}

function isTestMode(): boolean {
    return process.env.TEST_MODE === "1" || process.env.TEST_MODE === "true";
}

// For testing incident creation - simulates failures
function shouldSimulateFailures(): boolean {
    return process.env.SIMULATE_FAILURES === "1" || process.env.SIMULATE_FAILURES === "true";
}

function getBaseUrl(site: MonitoredSite): string {
    const basePath = site.basePath || "";
    return `https://${site.domain}${basePath}`;
}

function getSiteKey(site: MonitoredSite): string {
    return site.basePath ? `${site.domain}${site.basePath}` : site.domain;
}

function getIncidentName(failingSiteNames: string[]): string {
    const testMode = isTestMode();
    const sites = failingSiteNames.join(", ");
    return testMode ? `[TEST] ${INCIDENT_NAME_PREFIX}: ${sites}` : `${INCIDENT_NAME_PREFIX}: ${sites}`;
}

async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries: number = MAX_RETRIES
): Promise<{ response: Response | null; error?: string; responseTime: number }> {
    const startTime = Date.now();

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    "User-Agent": "Fern-Health-Monitor/1.0",
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);
            return { response, responseTime: Date.now() - startTime };
        } catch (error) {
            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
            }
            return {
                response: null,
                error: error instanceof Error ? error.message : String(error),
                responseTime: Date.now() - startTime
            };
        }
    }

    return { response: null, error: "Max retries exceeded", responseTime: Date.now() - startTime };
}

async function checkEndpoint(
    site: MonitoredSite,
    path: string,
    options: {
        expectedContentType?: string;
        minContentLength?: number;
        allowedStatusCodes?: number[];
        followRedirects?: boolean;
        validateResponse?: (response: Response, body: string) => { success: boolean; error?: string };
    } = {}
): Promise<CheckResult> {
    const baseUrl = getBaseUrl(site);
    const url = `${baseUrl}${path}`;
    const {
        expectedContentType,
        minContentLength = 0,
        allowedStatusCodes = [200],
        followRedirects = true,
        validateResponse
    } = options;

    const { response, error, responseTime } = await fetchWithRetry(url, {
        redirect: followRedirects ? "follow" : "manual"
    });

    if (!response) {
        return {
            site,
            endpoint: path,
            success: false,
            error: error || "Request failed",
            responseTime
        };
    }

    if (!allowedStatusCodes.includes(response.status)) {
        return {
            site,
            endpoint: path,
            success: false,
            error: `HTTP ${response.status} ${response.statusText}`,
            statusCode: response.status,
            responseTime
        };
    }

    const contentType = response.headers.get("content-type") || "";
    if (expectedContentType && !contentType.includes(expectedContentType)) {
        return {
            site,
            endpoint: path,
            success: false,
            error: `Invalid content-type: ${contentType}, expected: ${expectedContentType}`,
            statusCode: response.status,
            responseTime
        };
    }

    const text = await response.text();
    if (text.length < minContentLength) {
        return {
            site,
            endpoint: path,
            success: false,
            error: `Content too short: ${text.length} bytes (expected >= ${minContentLength})`,
            statusCode: response.status,
            responseTime
        };
    }

    if (validateResponse) {
        const validation = validateResponse(response, text);
        if (!validation.success) {
            return {
                site,
                endpoint: path,
                success: false,
                error: validation.error || "Response validation failed",
                statusCode: response.status,
                responseTime
            };
        }
    }

    return {
        site,
        endpoint: path,
        success: true,
        statusCode: response.status,
        responseTime
    };
}

async function checkSitemapXml(site: MonitoredSite): Promise<CheckResult> {
    return checkEndpoint(site, "/sitemap.xml", {
        expectedContentType: "xml",
        minContentLength: 100,
        validateResponse: (_response, body) => {
            if (!body.includes("<?xml") && !body.includes("<urlset") && !body.includes("<sitemapindex")) {
                return { success: false, error: "Response does not appear to be valid XML sitemap" };
            }
            return { success: true };
        }
    });
}

async function checkWhoami(site: MonitoredSite): Promise<CheckResult> {
    return checkEndpoint(site, "/api/fern-docs/whoami", {
        expectedContentType: "application/json",
        allowedStatusCodes: [200, 401, 403],
        validateResponse: (response, body) => {
            if (response.status === 401 || response.status === 403) {
                return { success: true };
            }
            try {
                JSON.parse(body);
                return { success: true };
            } catch {
                return { success: false, error: "Invalid JSON response from whoami endpoint" };
            }
        }
    });
}

async function checkHomePage(site: MonitoredSite): Promise<CheckResult> {
    return checkEndpoint(site, "/", {
        expectedContentType: "text/html",
        minContentLength: 1000,
        followRedirects: true,
        validateResponse: (_response, body) => {
            if (!body.includes("<html") && !body.includes("<!DOCTYPE")) {
                return { success: false, error: "Response does not appear to be valid HTML" };
            }
            return { success: true };
        }
    });
}

async function checkLlmsTxt(site: MonitoredSite): Promise<CheckResult> {
    return checkEndpoint(site, "/llms.txt", {
        expectedContentType: "text/plain",
        minContentLength: 50
    });
}

async function checkLlmsFullTxt(site: MonitoredSite): Promise<CheckResult> {
    return checkEndpoint(site, "/llms-full.txt", {
        expectedContentType: "text/plain",
        minContentLength: 100
    });
}

async function checkMdLinkFromLlmsTxt(site: MonitoredSite): Promise<CheckResult | null> {
    const baseUrl = getBaseUrl(site);
    const llmsTxtUrl = `${baseUrl}/llms.txt`;

    try {
        const { response } = await fetchWithRetry(llmsTxtUrl);
        if (!response || !response.ok) {
            return null;
        }

        const text = await response.text();
        const mdLinkMatch = text.match(/\[.*?\]\((.*?\.mdx?)\)/);

        if (mdLinkMatch) {
            let mdLink = mdLinkMatch[1];

            // Handle full URLs - extract path relative to site
            if (mdLink.startsWith("http://") || mdLink.startsWith("https://")) {
                try {
                    const url = new URL(mdLink);
                    mdLink = url.pathname;
                } catch {
                    return null;
                }
            }

            // Ensure path starts with /
            if (!mdLink.startsWith("/")) {
                mdLink = `/${mdLink}`;
            }

            // If site has a basePath and the extracted link already includes it, strip it
            // This prevents doubling (e.g., /docs/docs/overview/intro.mdx)
            if (site.basePath && mdLink.startsWith(site.basePath)) {
                mdLink = mdLink.slice(site.basePath.length);
                if (!mdLink.startsWith("/")) {
                    mdLink = `/${mdLink}`;
                }
            }

            return checkEndpoint(site, mdLink, {
                expectedContentType: "text/",
                minContentLength: 20
            });
        }
    } catch (error) {
        console.error(`[${site.name}] Failed to parse llms.txt for .md link:`, error);
    }

    return null;
}

async function checkSite(site: MonitoredSite): Promise<CheckResult[]> {
    console.log(`[${site.name}] Checking ${getSiteKey(site)}...`);

    // Run core checks in parallel
    const [sitemapResult, whoamiResult, homePageResult, llmsTxtResult, llmsFullTxtResult] = await Promise.all([
        checkSitemapXml(site),
        checkWhoami(site),
        checkHomePage(site),
        checkLlmsTxt(site),
        checkLlmsFullTxt(site)
    ]);

    const results: CheckResult[] = [sitemapResult, whoamiResult, homePageResult, llmsTxtResult, llmsFullTxtResult];

    // Check .md link if llms.txt succeeded
    if (llmsTxtResult.success) {
        const mdResult = await checkMdLinkFromLlmsTxt(site);
        if (mdResult) {
            results.push(mdResult);
        }
    }

    return results;
}

async function sendSlackAlert(failures: CheckResult[]): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL_DOCS_INCIDENTS;
    if (!webhookUrl) {
        console.warn("SLACK_WEBHOOK_URL_DOCS_INCIDENTS not configured, skipping Slack alert");
        return;
    }

    if (isDryRun()) {
        console.log(
            "[DRY RUN] Would send Slack alert for failures:",
            failures.map((f) => `${f.site.name}: ${f.endpoint}`).join(", ")
        );
        return;
    }

    const siteFailures = new Map<string, CheckResult[]>();
    for (const failure of failures) {
        const key = failure.site.name;
        const existing = siteFailures.get(key) || [];
        existing.push(failure);
        siteFailures.set(key, existing);
    }

    let message = "🚨 *Docs Health Check Failed*\n\n<!subteam^docs-on-call> Health checks are failing:\n\n";

    for (const [siteName, siteFailureList] of Array.from(siteFailures.entries())) {
        const site = siteFailureList[0].site;
        const baseUrl = getBaseUrl(site);
        message += `*${siteName}* (<${baseUrl}|${getSiteKey(site)}>)\n`;
        for (const f of siteFailureList) {
            message += `• \`${f.endpoint}\`: ${f.error}${f.statusCode ? ` (HTTP ${f.statusCode})` : ""}\n`;
        }
        message += "\n";
    }

    message += `_Timestamp: ${new Date().toISOString()}_`;

    try {
        const { response } = await fetchWithRetry(
            webhookUrl,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: message })
            },
            2
        );

        if (!response || !response.ok) {
            console.error(`Failed to send Slack alert: ${response?.status} ${response?.statusText}`);
        } else {
            console.log("Slack alert sent successfully");
        }
    } catch (error) {
        console.error("Error sending Slack alert:", error);
    }
}

async function sendSlackRecoveryAlert(): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL_DOCS_INCIDENTS;
    if (!webhookUrl || isDryRun()) {
        return;
    }

    const message = "✅ *Docs Health Check Recovered*\nAll monitored endpoints are now healthy.";

    try {
        await fetchWithRetry(
            webhookUrl,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: message })
            },
            2
        );
        console.log("Slack recovery alert sent");
    } catch (error) {
        console.error("Error sending Slack recovery alert:", error);
    }
}

async function findOpenIncident(apiKey: string): Promise<{ id: string; permalink: string } | null> {
    try {
        const testMode = isTestMode();
        const modeFilter = testMode ? "&mode%5Bone_of%5D=test" : "";

        const { response } = await fetchWithRetry(
            `https://api.incident.io/v2/incidents?page_size=250${modeFilter}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`
                }
            },
            2
        );

        if (!response || !response.ok) {
            console.error(`Failed to list incidents: ${response?.status} ${response?.statusText}`);
            return null;
        }

        const result = await response.json();

        // Find any open incident that starts with our prefix
        for (const incident of result.incidents) {
            const prefix = isTestMode() ? `[TEST] ${INCIDENT_NAME_PREFIX}` : INCIDENT_NAME_PREFIX;
            if (incident.name.startsWith(prefix)) {
                const category = incident.incident_status?.category;
                if (category && TERMINAL_INCIDENT_STATES.includes(category)) {
                    continue;
                }
                console.log(`Found existing open incident: ${incident.permalink}`);
                return { id: incident.id, permalink: incident.permalink };
            }
        }

        return null;
    } catch (error) {
        console.error("Error finding open incident:", error);
        return null;
    }
}

function determineSeverity(failuresBySite: Map<string, CheckResult[]>, totalSites: number): string {
    const failingSiteCount = failuresBySite.size;

    // Calculate total failures across all sites
    let totalFailures = 0;
    for (const failures of Array.from(failuresBySite.values())) {
        totalFailures += failures.length;
    }

    // Critical: All sites are failing with multiple endpoints each
    // (suggests a major infrastructure issue)
    const allSitesFailing = failingSiteCount === totalSites;
    const avgFailuresPerSite = totalFailures / failingSiteCount;

    if (allSitesFailing && avgFailuresPerSite >= CORE_CHECKS_PER_SITE * 0.8) {
        // All sites failing with most endpoints down
        console.log(
            `Severity: CRITICAL (all ${totalSites} sites failing, avg ${avgFailuresPerSite.toFixed(1)} failures per site)`
        );
        return process.env.INCIDENT_SEVERITY_CRITICAL || INCIDENT_SEVERITY_CRITICAL;
    }

    // Major: Multiple sites failing, or significant failures on single site
    if (failingSiteCount > 1 || avgFailuresPerSite >= 3) {
        console.log(
            `Severity: MAJOR (${failingSiteCount} sites failing, avg ${avgFailuresPerSite.toFixed(1)} failures per site)`
        );
        return process.env.INCIDENT_SEVERITY_MAJOR || INCIDENT_SEVERITY_MAJOR;
    }

    // Minor: Single site with few failures
    console.log(`Severity: MINOR (${failingSiteCount} site failing, ${totalFailures} total failures)`);
    return process.env.INCIDENT_SEVERITY_MINOR || INCIDENT_SEVERITY_MINOR;
}

function buildIncidentSummary(failuresBySite: Map<string, CheckResult[]>): string {
    let summary = "Docs health check failing for the following sites:\n\n";

    for (const [siteName, failures] of Array.from(failuresBySite.entries())) {
        const site = failures[0].site;
        const siteKey = getSiteKey(site);
        const failedEndpoints = failures.map((f) => f.endpoint).join(", ");
        summary += `${siteName} (${siteKey})\n\n`;
        summary += `Failed endpoints: ${failedEndpoints}\n\n`;
        summary += `Errors:\n${failures.map((f) => `- ${f.endpoint}: ${f.error}`).join("\n")}\n\n`;
    }

    return summary;
}

async function createIncident(failuresBySite: Map<string, CheckResult[]>, totalSites: number): Promise<string | null> {
    const apiKey = process.env.INCIDENT_API_KEY;
    if (!apiKey) {
        console.error("INCIDENT_API_KEY not configured, skipping incident creation");
        return null;
    }

    if (isDryRun()) {
        console.log("[DRY_RUN] Would create incident for failing sites:", Array.from(failuresBySite.keys()).join(", "));
        determineSeverity(failuresBySite, totalSites); // Log severity even in dry run
        return null;
    }

    const failingSiteNames = Array.from(failuresBySite.keys());
    const summary = buildIncidentSummary(failuresBySite);

    const severityId = determineSeverity(failuresBySite, totalSites);
    const testMode = isTestMode();
    // Use timestamp in idempotency key - we already check for open incidents before creating,
    // so this just prevents duplicate creation within the same second
    const timestamp = new Date().toISOString();
    const idempotencyKey = testMode ? `docs-health:test:${timestamp}` : `docs-health:${timestamp}`;

    const incidentPayload: Record<string, unknown> = {
        name: getIncidentName(failingSiteNames),
        idempotency_key: idempotencyKey,
        incident_status_id: INCIDENT_STATUS_MONITORING,
        severity_id: severityId,
        summary,
        visibility: "public"
    };

    if (testMode) {
        incidentPayload.mode = "test";
    }

    try {
        const { response } = await fetchWithRetry(
            "https://api.incident.io/v2/incidents",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify(incidentPayload)
            },
            2
        );

        if (!response || !response.ok) {
            const errorText = response ? await response.text() : "No response";
            console.error(`Failed to create incident: ${response?.status} ${response?.statusText}`, errorText);
            return null;
        }

        const result = await response.json();
        console.log(`Created incident: ${result.incident.permalink}`);
        return result.incident.id;
    } catch (error) {
        console.error("Error creating incident:", error);
        return null;
    }
}

async function updateIncident(
    incidentId: string,
    failuresBySite: Map<string, CheckResult[]>,
    totalSites: number
): Promise<void> {
    const apiKey = process.env.INCIDENT_API_KEY;
    if (!apiKey) {
        return;
    }

    if (isDryRun()) {
        console.log(`[DRY_RUN] Would update incident ${incidentId}`);
        determineSeverity(failuresBySite, totalSites); // Log severity even in dry run
        return;
    }

    const failingSiteNames = Array.from(failuresBySite.keys());
    const summary = buildIncidentSummary(failuresBySite);
    const severityId = determineSeverity(failuresBySite, totalSites);

    try {
        const { response } = await fetchWithRetry(
            `https://api.incident.io/v2/incidents/${incidentId}/actions/edit`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    incident: {
                        name: getIncidentName(failingSiteNames),
                        summary,
                        severity_id: severityId
                    },
                    notify_incident_channel: false
                })
            },
            2
        );

        if (!response || !response.ok) {
            const errorText = response ? await response.text() : "No response";
            console.error(`Failed to update incident: ${response?.status} ${response?.statusText}`, errorText);
            return;
        }

        console.log(`Updated incident: ${incidentId}`);
    } catch (error) {
        console.error("Error updating incident:", error);
    }
}

async function resolveIncident(incidentId: string): Promise<void> {
    const apiKey = process.env.INCIDENT_API_KEY;
    if (!apiKey) {
        return;
    }

    if (isDryRun()) {
        console.log(`[DRY_RUN] Would resolve incident ${incidentId}`);
        return;
    }

    try {
        const { response } = await fetchWithRetry(
            `https://api.incident.io/v2/incidents/${incidentId}/actions/edit`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    incident: { incident_status_id: INCIDENT_STATUS_CANCELED },
                    notify_incident_channel: false
                })
            },
            2
        );

        if (!response || !response.ok) {
            const errorText = response ? await response.text() : "No response";
            console.error(`Failed to resolve incident: ${response?.status} ${response?.statusText}`, errorText);
            return;
        }

        console.log(`Resolved incident: ${incidentId}`);
    } catch (error) {
        console.error("Error resolving incident:", error);
    }
}

async function handleIncident(failuresBySite: Map<string, CheckResult[]>, totalSites: number): Promise<void> {
    const apiKey = process.env.INCIDENT_API_KEY;
    if (!apiKey) {
        return;
    }

    const hasFailures = failuresBySite.size > 0;

    if (hasFailures) {
        // We have failures - create or update incident
        const existingIncident = await findOpenIncident(apiKey);
        if (existingIncident) {
            await updateIncident(existingIncident.id, failuresBySite, totalSites);
        } else {
            await createIncident(failuresBySite, totalSites);
        }
    } else {
        // All healthy - resolve any open incident
        const existingIncident = await findOpenIncident(apiKey);
        if (existingIncident) {
            await resolveIncident(existingIncident.id);
            await sendSlackRecoveryAlert();
        }
    }
}

async function main() {
    console.log(`[Health Monitor] Starting check at ${new Date().toISOString()}`);
    console.log(`[Health Monitor] Checking ${MONITORED_SITES.length} sites`);

    if (isDryRun()) {
        console.log("[Health Monitor] Running in DRY RUN mode - no alerts will be sent");
    }

    if (shouldSimulateFailures()) {
        console.log("[Health Monitor] SIMULATE_FAILURES mode - injecting fake failures for testing");
    }

    const allResults: Array<{ site: MonitoredSite; results: CheckResult[] }> = [];
    const allFailures: CheckResult[] = [];
    const failuresBySite = new Map<string, CheckResult[]>();

    // Check all sites in parallel
    const siteResults = await Promise.all(
        MONITORED_SITES.map((site) => checkSite(site).then((results) => ({ site, results })))
    );

    for (const { site, results } of siteResults) {
        allResults.push({ site, results });
        const siteFailures: CheckResult[] = [];

        for (const result of results) {
            if (result.success) {
                console.log(`[${site.name}] ✓ ${result.endpoint} - ${result.statusCode} (${result.responseTime}ms)`);
            } else {
                console.error(`[${site.name}] ✗ ${result.endpoint} - ${result.error} (${result.responseTime}ms)`);
                allFailures.push(result);
                siteFailures.push(result);
            }
        }

        if (siteFailures.length > 0) {
            failuresBySite.set(site.name, siteFailures);
        }
    }

    // Inject simulated failures for testing incident creation
    if (shouldSimulateFailures() && failuresBySite.size === 0) {
        // Use Fern Docs (index 1) for simulated failures
        const testSite = MONITORED_SITES[1];
        console.log(`[Health Monitor] Injecting simulated failure for ${testSite.name}`);
        const fakeFailure: CheckResult = {
            site: testSite,
            endpoint: "/simulated-test-endpoint",
            success: false,
            error: "Simulated failure for testing incident creation",
            statusCode: 500,
            responseTime: 0
        };
        allFailures.push(fakeFailure);
        failuresBySite.set(testSite.name, [fakeFailure]);
    }

    // Send Slack alert for all failures at once
    if (allFailures.length > 0) {
        await sendSlackAlert(allFailures);
    }

    // Handle single incident for all failures
    await handleIncident(failuresBySite, MONITORED_SITES.length);

    const totalChecks = allResults.reduce((sum, { results }) => sum + results.length, 0);
    const totalFailures = allFailures.length;

    console.log(`\n[Health Monitor] Completed: ${totalChecks} checks, ${totalFailures} failures`);

    if (totalFailures > 0) {
        process.exit(1);
    }

    console.log("[Health Monitor] All checks passed!");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});

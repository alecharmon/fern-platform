#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Synthetic monitoring script for llms.txt, llms-full.txt, and .md/.mdx endpoints
 *
 * This script:
 * 1. Checks llms.txt, llms-full.txt, and .md endpoints for configured domains
 * 2. Sends alerts to Slack on failures
 * 3. Creates incidents in incident.io when endpoints are down
 * 4. Auto-resolves incidents when endpoints recover
 */

interface MonitoredSite {
    domain: string;
    name: string;
}

interface CheckResult {
    domain: string;
    endpoint: string;
    success: boolean;
    error?: string;
    statusCode?: number;
    responseTime?: number;
}

interface IncidentState {
    [key: string]: string; // domain+endpoint -> incident_id
}

interface Incident {
    id: string;
    name: string;
    permalink: string;
    incident_status: {
        category: string;
    };
}

const MONITORED_SITES: MonitoredSite[] = [
    { domain: "buildwithfern.com/learn", name: "Fern Docs" },
    { domain: "elevenlabs.io/docs", name: "ElevenLabs" },
    { domain: "openrouter.ai/docs", name: "OpenRouter" },
    { domain: "docs.ada.cx/generative/home", name: "Ada" },
    { domain: "docs.letta.com", name: "Letta" }
];

const TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

const INCIDENT_STATUS_MONITORING = "01HR85VFNXWH1H6976YCEJ5XJB";
const INCIDENT_STATUS_CANCELED = "01HR85VFNXMV8SBQ3FRPMDBCST";
const INCIDENT_STATUS_CLOSED = "01HR85VFNXJPF6TXWYTXA6NBS2";
const INCIDENT_SEVERITY_MINOR = "01HR85VFNX9NYZG6B5Z40K8Y9V";

const TERMINAL_INCIDENT_STATES = ["declined", "merged", "canceled", "learning", "closed"];

let incidentState: IncidentState = {};

function isTestMode(): boolean {
    return process.env.TEST_MODE === "1" || process.env.TEST_MODE === "true";
}

function getIncidentName(siteName: string): string {
    const testMode = isTestMode();
    return testMode ? `[TEST] LLM docs endpoints down: ${siteName}` : `LLM docs endpoints down: ${siteName}`;
}

function shouldSendSlack(): boolean {
    const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
    const testMode = isTestMode();
    const enableSlack = process.env.ENABLE_SLACK_ALERTS === "1" || process.env.ENABLE_SLACK_ALERTS === "true";

    if (dryRun || testMode) {
        return false;
    }

    return enableSlack;
}

async function checkEndpoint(
    domain: string,
    pathOrUrl: string,
    expectedContentType: string,
    minContentLength: number = 10
): Promise<CheckResult> {
    const base = new URL(`https://${domain}/`);
    const finalUrl = new URL(pathOrUrl, base);
    const url = finalUrl.href;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Fern-Monitor/1.0"
                }
            });

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            if (!response.ok) {
                if (attempt < MAX_RETRIES) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    continue;
                }
                return {
                    domain,
                    endpoint: pathOrUrl,
                    success: false,
                    error: `HTTP ${response.status} ${response.statusText}`,
                    statusCode: response.status,
                    responseTime
                };
            }

            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes(expectedContentType)) {
                return {
                    domain,
                    endpoint: pathOrUrl,
                    success: false,
                    error: `Invalid content-type: ${contentType}, expected: ${expectedContentType}`,
                    statusCode: response.status,
                    responseTime
                };
            }

            const text = await response.text();
            if (text.length < minContentLength) {
                return {
                    domain,
                    endpoint: pathOrUrl,
                    success: false,
                    error: `Content too short: ${text.length} bytes`,
                    statusCode: response.status,
                    responseTime
                };
            }

            return {
                domain,
                endpoint: pathOrUrl,
                success: true,
                statusCode: response.status,
                responseTime
            };
        } catch (error) {
            if (attempt < MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                continue;
            }
            return {
                domain,
                endpoint: pathOrUrl,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                responseTime: Date.now() - startTime
            };
        }
    }

    return {
        domain,
        endpoint: pathOrUrl,
        success: false,
        error: "Max retries exceeded",
        responseTime: Date.now() - startTime
    };
}

async function checkSite(site: MonitoredSite): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    results.push(await checkEndpoint(site.domain, "llms.txt", "text/plain", 50));

    results.push(await checkEndpoint(site.domain, "llms-full.txt", "text/plain", 100));

    try {
        const llmsTxtResult = results[0];
        if (llmsTxtResult.success) {
            const llmsTxtUrl = `https://${site.domain}/llms.txt`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
            const response = await fetch(llmsTxtUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                console.error(
                    `[${site.name}] Failed to fetch llms.txt for .md link extraction: HTTP ${response.status} ${response.statusText}`
                );
                return results;
            }
            const text = await response.text();

            const mdLinkMatch = text.match(/\[.*?\]\((.*?\.mdx?)\)/);
            if (mdLinkMatch) {
                const mdLink = mdLinkMatch[1];
                results.push(await checkEndpoint(site.domain, mdLink, "text/", 20));
            }
        }
    } catch (error) {
        console.error(`[${site.name}] Failed to parse llms.txt for .md link:`, error);
    }

    return results;
}

async function sendSlackAlert(message: string): Promise<void> {
    if (!shouldSendSlack()) {
        return;
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL_DOCS_INCIDENTS;
    if (!webhookUrl) {
        console.warn("ENABLE_SLACK_ALERTS=1 but SLACK_WEBHOOK_URL_DOCS_INCIDENTS not configured");
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`Failed to send Slack alert: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error sending Slack alert:", error);
    }
}

async function findOpenIncident(siteName: string, apiKey: string): Promise<string | null> {
    try {
        const testMode = isTestMode();
        const modeFilter = testMode ? "&mode%5Bone_of%5D=test" : "";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const response = await fetch(`https://api.incident.io/v2/incidents?page_size=250${modeFilter}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`Failed to list incidents: ${response.status} ${response.statusText}`);
            return null;
        }

        const result = await response.json();
        const incidentName = getIncidentName(siteName);

        for (const incident of result.incidents) {
            if (incident.name === incidentName) {
                const category = incident.incident_status?.category;
                if (category && TERMINAL_INCIDENT_STATES.includes(category)) {
                    continue;
                }
                console.log(`[${siteName}] Found existing open incident: ${incident.permalink}`);
                return incident.id;
            }
        }

        return null;
    } catch (error) {
        console.error("Error finding open incident:", error);
        return null;
    }
}

async function updateIncident(
    incidentId: string,
    siteName: string,
    domain: string,
    failures: CheckResult[]
): Promise<void> {
    const apiKey = process.env.INCIDENT_API_KEY;
    if (!apiKey) {
        return;
    }

    const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
    if (dryRun) {
        console.log(`[${siteName}] DRY_RUN mode: would update incident ${incidentId}`);
        return;
    }

    const failedEndpoints = failures.map((f) => f.endpoint).join(", ");
    const summary = `LLM-friendly docs endpoints failing for ${siteName} (${domain})\n\nFailed endpoints: ${failedEndpoints}\n\nErrors:\n${failures.map((f) => `- ${f.endpoint}: ${f.error}`).join("\n")}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const response = await fetch(`https://api.incident.io/v2/incidents/${incidentId}/actions/edit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                incident: {
                    summary
                },
                notify_incident_channel: false
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to update incident: ${response.status} ${response.statusText}`, errorText);
            return;
        }

        console.log(`[${siteName}] Updated incident: ${incidentId}`);
    } catch (error) {
        console.error("Error updating incident:", error);
    }
}

async function createIncident(siteName: string, domain: string, failures: CheckResult[]): Promise<string | null> {
    const apiKey = process.env.INCIDENT_API_KEY;
    if (!apiKey) {
        console.error("INCIDENT_API_KEY not configured, skipping incident creation");
        return null;
    }

    const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
    if (dryRun) {
        console.log(`[${siteName}] DRY_RUN mode: would create incident for ${domain}`);
        return null;
    }

    const failedEndpoints = failures.map((f) => f.endpoint).join(", ");
    const summary = `LLM-friendly docs endpoints failing for ${siteName} (${domain})\n\nFailed endpoints: ${failedEndpoints}\n\nErrors:\n${failures.map((f) => `- ${f.endpoint}: ${f.error}`).join("\n")}`;

    const severityId = process.env.INCIDENT_SEVERITY_ID || INCIDENT_SEVERITY_MINOR;
    const testMode = isTestMode();
    const idempotencyKey = testMode ? `llms-monitor:test:${domain}` : `llms-monitor:${domain}`;
    const incidentPayload: any = {
        name: getIncidentName(siteName),
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const response = await fetch("https://api.incident.io/v2/incidents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify(incidentPayload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to create incident: ${response.status} ${response.statusText}`, errorText);
            return null;
        }

        const result = await response.json();
        console.log(`[${siteName}] Created incident: ${result.incident.permalink}`);
        return result.incident.id;
    } catch (error) {
        console.error("Error creating incident:", error);
        return null;
    }
}

async function resolveIncident(incidentId: string, siteName: string): Promise<void> {
    const apiKey = process.env.INCIDENT_API_KEY;
    if (!apiKey) {
        return;
    }

    const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
    if (dryRun) {
        console.log(`[${siteName}] DRY_RUN mode: would resolve incident ${incidentId}`);
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const response = await fetch(`https://api.incident.io/v2/incidents/${incidentId}/actions/edit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                incident: {
                    incident_status_id: INCIDENT_STATUS_CANCELED
                },
                notify_incident_channel: false
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to resolve incident: ${response.status} ${response.statusText}`, errorText);
            return;
        }

        console.log(`[${siteName}] Resolved incident: ${incidentId}`);
    } catch (error) {
        console.error("Error resolving incident:", error);
    }
}

async function main() {
    console.log(`[Monitor] Starting check at ${new Date().toISOString()}`);
    console.log(`[Monitor] Checking ${MONITORED_SITES.length} sites`);

    const allResults: Array<{ site: MonitoredSite; results: CheckResult[] }> = [];

    for (const site of MONITORED_SITES) {
        console.log(`[${site.name}] Checking ${site.domain}...`);
        const results = await checkSite(site);
        allResults.push({ site, results });

        for (const result of results) {
            if (result.success) {
                console.log(`[${site.name}] ✓ ${result.endpoint} - ${result.statusCode} (${result.responseTime}ms)`);
            } else {
                console.error(`[${site.name}] ✗ ${result.endpoint} - ${result.error} (${result.responseTime}ms)`);
            }
        }
    }

    const apiKey = process.env.INCIDENT_API_KEY;
    const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

    for (const { site, results } of allResults) {
        const failures = results.filter((r) => !r.success);
        const incidentKey = `${site.domain}`;

        if (failures.length > 0) {
            await sendSlackAlert(
                `🚨 *Docs endpoints failing for ${site.name}*\n` +
                    `Domain: ${site.domain}\n` +
                    `Failed endpoints: ${failures.map((f) => f.endpoint).join(", ")}\n` +
                    `Errors:\n${failures.map((f) => `• ${f.endpoint}: ${f.error}`).join("\n")}`
            );

            if (!incidentState[incidentKey] && apiKey) {
                const existingIncidentId = await findOpenIncident(site.name, apiKey);
                if (existingIncidentId) {
                    incidentState[incidentKey] = existingIncidentId;
                    await updateIncident(existingIncidentId, site.name, site.domain, failures);
                } else {
                    const incidentId = await createIncident(site.name, site.domain, failures);
                    if (incidentId) {
                        incidentState[incidentKey] = incidentId;
                    }
                }
            } else if (incidentState[incidentKey]) {
                await updateIncident(incidentState[incidentKey], site.name, site.domain, failures);
            }
        } else {
            if (incidentState[incidentKey]) {
                await resolveIncident(incidentState[incidentKey], site.name);
                await sendSlackAlert(
                    `✅ *Docs endpoints recovered for ${site.name}*\n` +
                        `Domain: ${site.domain}\n` +
                        `All endpoints are now healthy.`
                );
                delete incidentState[incidentKey];
            } else if (apiKey && !dryRun) {
                const existingIncidentId = await findOpenIncident(site.name, apiKey);
                if (existingIncidentId) {
                    await resolveIncident(existingIncidentId, site.name);
                    await sendSlackAlert(
                        `✅ *Docs endpoints recovered for ${site.name}*\n` +
                            `Domain: ${site.domain}\n` +
                            `All endpoints are now healthy.`
                    );
                }
            }
        }
    }

    const totalChecks = allResults.reduce((sum, { results }) => sum + results.length, 0);
    const totalFailures = allResults.reduce((sum, { results }) => sum + results.filter((r) => !r.success).length, 0);

    console.log(`[Monitor] Completed: ${totalChecks} checks, ${totalFailures} failures`);

    if (totalFailures > 0) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});

import type { VercelDomainConfig, VercelDomainResult } from "./types";

const VERCEL_API_BASE = "https://api.vercel.com";

function getVercelConfig() {
    const token = process.env.VERCEL_ACCESS_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const orgId = process.env.VERCEL_TEAM_ID;

    if (!token) {
        throw new Error("VERCEL_ACCESS_TOKEN environment variable is required");
    }
    if (!projectId) {
        throw new Error("VERCEL_PROJECT_ID environment variable is required");
    }
    if (!orgId) {
        throw new Error("VERCEL_TEAM_ID environment variable is required");
    }

    return { token, projectId, orgId };
}

/**
 * Adds a domain to the Vercel project
 *
 * @param domain - The domain to add (e.g., docs.example.com)
 * @returns VercelDomainResult with success status and domain info
 */
export async function addDomainToVercelProject(domain: string): Promise<VercelDomainResult> {
    const { token, projectId, orgId } = getVercelConfig();

    try {
        const response = await fetch(`${VERCEL_API_BASE}/v10/projects/${projectId}/domains?teamId=${orgId}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: domain })
        });

        const data = await response.json();

        if (!response.ok) {
            // Handle specific Vercel error codes
            if (data.error?.code === "domain_already_in_use") {
                return {
                    success: false,
                    error: "This domain is already in use by another Vercel project."
                };
            }
            if (data.error?.code === "invalid_domain") {
                return {
                    success: false,
                    error: "Invalid domain format."
                };
            }
            if (data.error?.code === "forbidden") {
                return {
                    success: false,
                    error: "Not authorized to add domains to this project."
                };
            }

            return {
                success: false,
                error: data.error?.message || "Failed to add domain to Vercel."
            };
        }

        return {
            success: true,
            domain: data.name,
            domainId: data.id,
            verification: data.verification
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}

/**
 * Removes a domain from the Vercel project
 *
 * @param domain - The domain to remove
 * @returns Object with success status and optional error
 */
export async function removeDomainFromVercelProject(domain: string): Promise<{ success: boolean; error?: string }> {
    const { token, projectId, orgId } = getVercelConfig();

    try {
        const response = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}?teamId=${orgId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const data = await response.json();

            if (response.status === 404) {
                // Domain not found - might have been already removed
                return { success: true };
            }

            return {
                success: false,
                error: data.error?.message || "Failed to remove domain from Vercel."
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}

/**
 * Gets the status of a domain in the Vercel project
 *
 * @param domain - The domain to check
 * @returns Domain info if found, null if not found
 */
export async function getDomainFromVercelProject(domain: string): Promise<VercelDomainResult | null> {
    const { token, projectId, orgId } = getVercelConfig();

    try {
        const response = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}?teamId=${orgId}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            const data = await response.json();
            return {
                success: false,
                error: data.error?.message || "Failed to get domain info from Vercel."
            };
        }

        const data = await response.json();
        return {
            success: true,
            domain: data.name,
            domainId: data.id,
            verification: data.verification
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}

/**
 * Gets the DNS configuration for a domain from Vercel
 * This tells us what DNS records the user needs to add
 *
 * @param domain - The domain to check
 * @returns Domain configuration with required DNS records
 */
export async function getDomainConfigFromVercel(domain: string): Promise<VercelDomainConfig> {
    const { token, projectId, orgId } = getVercelConfig();

    try {
        // First, get domain info from the project endpoint (has more accurate DNS info)
        const projectDomainResponse = await fetch(
            `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}?teamId=${orgId}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        let projectDomainData = null;
        if (projectDomainResponse.ok) {
            projectDomainData = await projectDomainResponse.json();
        }

        // Also get the domain config endpoint for misconfigured status
        const configResponse = await fetch(`${VERCEL_API_BASE}/v6/domains/${domain}/config?teamId=${orgId}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!configResponse.ok) {
            const data = await configResponse.json();
            return {
                configuredBy: null,
                misconfigured: true,
                dnsRecords: getDefaultDnsRecords(domain),
                error: data.error?.message
            };
        }

        const configData = await configResponse.json();

        // Extract the DNS records that need to be configured
        const dnsRecords: VercelDomainConfig["dnsRecords"] = [];

        // If misconfigured, build the required DNS records from Vercel's recommendations
        if (configData.misconfigured) {
            const subdomain = getSubdomain(domain);

            // recommendedCNAME is an array sorted by rank, use the first (best) recommendation
            const bestCNAME = configData.recommendedCNAME?.[0]?.value;
            // recommendedIPv4 is an array sorted by rank, each with a value array of IPs
            const bestIPv4 = configData.recommendedIPv4?.[0]?.value;

            // Priority 1: Use recommendedCNAME from Vercel (for subdomains)
            if (bestCNAME && subdomain) {
                dnsRecords.push({
                    type: "CNAME",
                    name: subdomain,
                    // Remove trailing dot if present for cleaner display
                    value: bestCNAME.endsWith(".") ? bestCNAME.slice(0, -1) : bestCNAME
                });
            }
            // Priority 2: Use recommendedIPv4 (for apex domains or if no CNAME)
            else if (bestIPv4 && bestIPv4.length > 0) {
                for (const ip of bestIPv4) {
                    dnsRecords.push({
                        type: "A",
                        name: "@",
                        value: ip
                    });
                }
            }
            // Priority 3: Legacy fields - cnames array
            else if (configData.cnames && configData.cnames.length > 0) {
                dnsRecords.push({
                    type: "CNAME",
                    name: subdomain || domain,
                    value: configData.cnames[0]
                });
            }
            // Priority 4: Legacy fields - aValues array
            else if (configData.aValues && configData.aValues.length > 0) {
                for (const aValue of configData.aValues) {
                    dnsRecords.push({
                        type: "A",
                        name: "@",
                        value: aValue
                    });
                }
            }
            // Priority 5: Fallback to defaults if nothing else works
            else if (subdomain) {
                dnsRecords.push({
                    type: "CNAME",
                    name: subdomain,
                    value: "cname.vercel-dns.com"
                });
            } else {
                dnsRecords.push({
                    type: "A",
                    name: "@",
                    value: "76.76.21.21"
                });
            }
        }

        // Add any verification records from project domain data
        if (projectDomainData?.verification && projectDomainData.verification.length > 0) {
            for (const v of projectDomainData.verification) {
                // Avoid duplicates
                const exists = dnsRecords.some((r) => r.type === v.type && r.value === v.value);
                if (!exists) {
                    dnsRecords.push({
                        type: v.type as "TXT",
                        name: v.domain,
                        value: v.value
                    });
                }
            }
        }

        // Check for challenges from config endpoint
        if (configData.challenges && configData.challenges.length > 0) {
            for (const challenge of configData.challenges) {
                if (challenge.type === "dns-01" || challenge.type === "TXT") {
                    const exists = dnsRecords.some((r) => r.type === "TXT" && r.value === challenge.value);
                    if (!exists) {
                        dnsRecords.push({
                            type: "TXT",
                            name: challenge.domain || `_acme-challenge.${domain}`,
                            value: challenge.value
                        });
                    }
                }
            }
        }

        return {
            configuredBy: configData.configuredBy || null,
            misconfigured: configData.misconfigured ?? false,
            dnsRecords
        };
    } catch (error) {
        console.error("[getDomainConfigFromVercel] Error:", error);
        return {
            configuredBy: null,
            misconfigured: true,
            dnsRecords: getDefaultDnsRecords(domain),
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}

/**
 * Check if a domain is an apex domain (no subdomain)
 */
function isApexDomain(domain: string): boolean {
    const parts = domain.split(".");
    // apex domain has exactly 2 parts (example.com) or is a known TLD pattern
    return parts.length === 2;
}

/**
 * Get the subdomain part of a domain (e.g., "docs" from "docs.example.com")
 */
function getSubdomain(domain: string): string | null {
    const parts = domain.split(".");
    if (parts.length <= 2) {
        return null; // apex domain
    }
    return parts[0] || null;
}

/**
 * Get default DNS records for a domain
 */
function getDefaultDnsRecords(domain: string): VercelDomainConfig["dnsRecords"] {
    if (isApexDomain(domain)) {
        return [
            {
                type: "A",
                name: "@",
                value: "76.76.21.21"
            }
        ];
    }
    return [
        {
            type: "CNAME",
            name: domain.split(".")[0] || domain,
            value: "cname.vercel-dns.com"
        }
    ];
}

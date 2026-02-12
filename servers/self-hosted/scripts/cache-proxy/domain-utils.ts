/**
 * Domain validation utilities for CORS proxy SSRF protection.
 */

/**
 * Extract the root domain from a hostname.
 * For example: "docs.example.com" -> "example.com"
 * Handles common TLDs like .com, .org, .io, .co.uk, etc.
 */
export function getRootDomain(hostname: string): string {
    const parts = hostname.toLowerCase().split(".");
    if (parts.length <= 2) {
        return hostname.toLowerCase();
    }
    // Handle common two-part TLDs like .co.uk, .com.au, etc.
    const twoPartTlds = ["co.uk", "com.au", "co.nz", "co.jp", "com.br", "co.in", "org.uk", "net.au"];
    const lastTwo = parts.slice(-2).join(".");
    if (twoPartTlds.includes(lastTwo)) {
        return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
}

/**
 * Check if a target hostname matches a given allowed domain.
 * Returns true if target matches the root domain or is a subdomain of it.
 */
export function matchesDomain(targetHostname: string, allowedDomain: string): boolean {
    const allowedRoot = getRootDomain(allowedDomain);
    const targetLower = targetHostname.toLowerCase();
    return targetLower === allowedRoot || targetLower.endsWith("." + allowedRoot);
}

/**
 * Check if a target hostname is allowed based on the docs domain and additional allowed domains.
 * Returns true if the target domain matches or is a subdomain of any allowed root domain.
 */
export function isProxyTargetAllowed(targetHostname: string, docsDomain: string, additionalDomains: string[]): boolean {
    // If no docs domain is configured, allow all (backward compatibility)
    if (!docsDomain && additionalDomains.length === 0) {
        return true;
    }
    // Check against docs domain
    if (docsDomain && matchesDomain(targetHostname, docsDomain)) {
        return true;
    }
    // Check against additional allowed domains
    for (const domain of additionalDomains) {
        if (matchesDomain(targetHostname, domain)) {
            return true;
        }
    }
    return false;
}

import type { ValidationResult } from "./types";

/**
 * Validates a domain format for custom domain setup
 *
 * Rules:
 * - Must be a valid domain format (e.g., docs.example.com or example.com/docs)
 * - Cannot be a wildcard domain
 * - Cannot be a buildwithfern.com subdomain
 * - Must have a valid TLD
 * - Subpaths are allowed (e.g., example.com/docs)
 */
export function validateDomainFormat(domain: string): ValidationResult {
    // Trim and lowercase
    const cleanDomain = domain.trim().toLowerCase();

    // Remove protocol if present
    const withoutProtocol = cleanDomain.replace(/^https?:\/\//, "");

    // Extract domain part (before any path)
    const domainPart = withoutProtocol.split("/")[0];

    if (!domainPart || domainPart.length === 0) {
        return { valid: false, error: "Domain is required." };
    }

    // Check for valid domain format
    // Allows subdomains like docs.example.com, api.docs.example.co.uk
    const domainRegex = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/;
    if (!domainRegex.test(domainPart)) {
        return { valid: false, error: "Invalid domain format. Example: docs.example.com" };
    }

    // Check for consecutive hyphens (invalid in domain names)
    if (domainPart.includes("--")) {
        return { valid: false, error: "Domain cannot contain consecutive hyphens." };
    }

    // Disallow wildcards
    if (domainPart.includes("*")) {
        return { valid: false, error: "Wildcard domains are not supported." };
    }

    // Disallow buildwithfern.com subdomains
    if (domainPart.endsWith(".buildwithfern.com") || domainPart === "buildwithfern.com") {
        return { valid: false, error: "Cannot use buildwithfern.com domains as custom domains." };
    }

    // Disallow common reserved/internal domains
    const reservedDomains = ["localhost", "example.com", "example.org", "example.net", "test.com", "invalid"];
    const baseDomain = domainPart.split(".").slice(-2).join(".");
    if (reservedDomains.includes(baseDomain) || reservedDomains.includes(domainPart)) {
        return { valid: false, error: "This domain is reserved and cannot be used." };
    }

    // Validate subpath if present (only alphanumeric, hyphens, and forward slashes)
    const pathPart = withoutProtocol.slice(domainPart.length);
    if (pathPart && pathPart !== "/") {
        const pathRegex = /^(\/[a-z0-9-]+)+\/?$/;
        if (!pathRegex.test(pathPart)) {
            return { valid: false, error: "Invalid subpath format. Use lowercase letters, numbers, and hyphens." };
        }
    }

    return { valid: true };
}

/**
 * Normalizes a domain by removing protocol and trailing slashes
 */
export function normalizeDomain(domain: string): string {
    return domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]!;
}

/**
 * Generates the TXT record host for domain verification
 */
export function getVerificationHost(domain: string): string {
    return `_fern-verification.${normalizeDomain(domain)}`;
}

/**
 * Generates a unique verification value
 */
export function generateVerificationValue(): string {
    return `fern-verify=${crypto.randomUUID()}`;
}

/**
 * Checks if a domain includes a subpath (e.g., example.com/docs)
 */
export function hasSubpath(domain: string): boolean {
    const cleaned = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "");
    const parts = cleaned.split("/").filter(Boolean);
    return parts.length > 1;
}

/**
 * Extracts the subpath from a domain (e.g., example.com/docs -> /docs)
 * Returns empty string if no subpath
 */
export function getSubpath(domain: string): string {
    const cleaned = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, ""); // Remove trailing slash
    const slashIndex = cleaned.indexOf("/");
    if (slashIndex === -1) {
        return "";
    }
    return cleaned.slice(slashIndex);
}

/**
 * Extracts just the domain part without any subpath (e.g., example.com/docs -> example.com)
 */
export function getDomainWithoutSubpath(domain: string): string {
    const cleaned = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "");
    return cleaned.split("/")[0] || cleaned;
}

/**
 * Normalizes a domain with subpath by removing protocol and normalizing slashes
 * Unlike normalizeDomain, this preserves the subpath
 */
export function normalizeDomainWithSubpath(domain: string): string {
    return domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, ""); // Remove trailing slash
}

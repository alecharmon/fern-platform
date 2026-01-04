import { Resolver } from "dns/promises";

import type { DnsLookupResult } from "./types";

/**
 * Looks up TXT records for a hostname using public DNS servers
 *
 * @param hostname - The hostname to lookup (e.g., _fern-verification.docs.example.com)
 * @returns DnsLookupResult with success status and records if found
 */
export async function lookupTxtRecord(hostname: string): Promise<DnsLookupResult> {
    const resolver = new Resolver();
    // Use public DNS servers for reliable lookups
    resolver.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);

    try {
        const records = await resolver.resolveTxt(hostname);
        // TXT records come as arrays of strings (for records > 255 chars), flatten them
        const flattenedRecords = records.map((r) => r.join(""));
        return { success: true, records: flattenedRecords };
    } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException;

        // ENODATA and ENOTFOUND mean no records found, which is not an error
        if (err.code === "ENODATA" || err.code === "ENOTFOUND") {
            return { success: true, records: [] };
        }

        // ETIMEOUT means DNS server didn't respond
        if (err.code === "ETIMEOUT") {
            return {
                success: false,
                error: "DNS lookup timed out. Please try again."
            };
        }

        // ESERVFAIL means DNS server returned an error
        if (err.code === "ESERVFAIL") {
            return {
                success: false,
                error: "DNS server error. Please check your domain configuration."
            };
        }

        return {
            success: false,
            error: `DNS lookup failed: ${err.message || "Unknown error"}`
        };
    }
}

/**
 * Verifies that a TXT record matches the expected verification value
 *
 * @param hostname - The hostname to lookup
 * @param expectedValue - The expected TXT record value
 * @returns Object with verified status and any found records
 */
export async function verifyTxtRecord(
    hostname: string,
    expectedValue: string
): Promise<{
    verified: boolean;
    records: string[];
    error?: string;
}> {
    const result = await lookupTxtRecord(hostname);

    if (!result.success) {
        return {
            verified: false,
            records: [],
            error: result.error
        };
    }

    const records = result.records || [];

    // Security: Only allow exact match to prevent spoofing via substring attacks
    // e.g., prevent "malicious-fern-verify=abc123" from matching "fern-verify=abc123"
    const normalizedExpected = expectedValue.trim();
    const verified = records.some((record) => record.trim() === normalizedExpected);

    return {
        verified,
        records,
        error: verified ? undefined : "Verification record not found. Please ensure the TXT record is added correctly."
    };
}

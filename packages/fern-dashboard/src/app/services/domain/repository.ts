import type { CustomDomainVerificationInsert } from "../supabase";
import { getSupabaseClient } from "../supabase";
import type { CustomDomainVerification, DomainVerificationStatus } from "./types";
import {
    generateVerificationValue,
    getVerificationHost,
    normalizeDomain,
    normalizeDomainWithSubpath
} from "./validation";

const VERIFICATION_EXPIRY_HOURS = 24;

function generateId(): string {
    return crypto.randomUUID();
}

/**
 * Creates a new domain verification record
 *
 * @param data - Domain, docsUrl, and orgId
 * @returns The created verification record
 */
export async function createVerification(data: {
    domain: string;
    docsUrl: string;
    orgId: string;
}): Promise<CustomDomainVerification> {
    const supabase = getSupabaseClient();
    const normalizedDomain = normalizeDomainWithSubpath(data.domain);
    const verificationValue = generateVerificationValue();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + VERIFICATION_EXPIRY_HOURS);

    // Delete any existing verification for this docsUrl first
    // This allows users to restart the verification process
    await supabase.from("CustomDomainVerification").delete().eq("docsUrl", data.docsUrl);

    const newRecord: CustomDomainVerificationInsert = {
        id: generateId(),
        domain: normalizedDomain,
        docsUrl: data.docsUrl,
        orgId: data.orgId,
        verificationValue,
        status: "PENDING",
        vercelDomainId: null,
        verifiedAt: null,
        expiresAt: expiresAt.toISOString(),
        setupStep: "update-config"
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
        .from("CustomDomainVerification")
        .insert(newRecord)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create verification: ${error.message}`);
    }

    return created as unknown as CustomDomainVerification;
}

/**
 * Gets verification record by docs URL
 */
export async function getVerificationByDocsUrl(docsUrl: string): Promise<CustomDomainVerification | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from("CustomDomainVerification").select().eq("docsUrl", docsUrl).single();

    if (error) {
        if (error.code === "PGRST116") {
            // No rows returned
            return null;
        }
        throw new Error(`Failed to get verification: ${error.message}`);
    }

    return data as unknown as CustomDomainVerification;
}

/**
 * Gets verification record by domain
 */
export async function getVerificationByDomain(domain: string): Promise<CustomDomainVerification | null> {
    const supabase = getSupabaseClient();
    const normalizedDomain = normalizeDomain(domain);

    const { data, error } = await supabase
        .from("CustomDomainVerification")
        .select()
        .eq("domain", normalizedDomain)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            // No rows returned
            return null;
        }
        throw new Error(`Failed to get verification: ${error.message}`);
    }

    return data as unknown as CustomDomainVerification;
}

/**
 * Updates verification status
 */
export async function updateVerificationStatus(
    id: string,
    status: DomainVerificationStatus,
    vercelDomainId?: string
): Promise<CustomDomainVerification> {
    const supabase = getSupabaseClient();

    const updateData: Partial<CustomDomainVerificationInsert> = {
        status
    };

    if (vercelDomainId) {
        updateData.vercelDomainId = vercelDomainId;
    }

    if (status === "VERIFIED") {
        updateData.verifiedAt = new Date().toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("CustomDomainVerification")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update verification: ${error.message}`);
    }

    return data as unknown as CustomDomainVerification;
}

/**
 * Deletes a verification record by ID
 */
export async function deleteVerification(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from("CustomDomainVerification").delete().eq("id", id);

    if (error) {
        throw new Error(`Failed to delete verification: ${error.message}`);
    }
}

/**
 * Deletes a verification record by docsUrl
 */
export async function deleteVerificationByDocsUrl(docsUrl: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from("CustomDomainVerification").delete().eq("docsUrl", docsUrl);

    if (error) {
        throw new Error(`Failed to delete verification: ${error.message}`);
    }
}

/**
 * Checks if a domain is already claimed by another site
 *
 * @param domain - The domain to check
 * @param excludeDocsUrl - Optionally exclude a specific docsUrl from the check
 * @returns True if the domain is available, false if already claimed
 */
export async function isDomainAvailable(domain: string, excludeDocsUrl?: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const normalizedDomain = normalizeDomainWithSubpath(domain);

    const { data, error } = await supabase
        .from("CustomDomainVerification")
        .select()
        .eq("domain", normalizedDomain)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            // No rows returned - domain is available
            return true;
        }
        throw new Error(`Failed to check domain availability: ${error.message}`);
    }

    const existing = data as unknown as CustomDomainVerification | null;

    if (!existing) {
        return true;
    }

    // If the domain exists but belongs to the excluded docsUrl, it's "available" for update
    if (excludeDocsUrl && existing.docsUrl === excludeDocsUrl) {
        return true;
    }

    // If the existing verification is expired and not verified, it's available
    // Delete the expired record and verify it was actually deleted to prevent race conditions
    if (existing.status === "PENDING" && new Date(existing.expiresAt) < new Date()) {
        const { error: deleteError, count } = await supabase
            .from("CustomDomainVerification")
            .delete()
            .eq("id", existing.id)
            .eq("status", "PENDING") // Ensure status hasn't changed
            .lt("expiresAt", new Date().toISOString()) // Re-verify expiration
            .select();

        // Only return available if we successfully deleted the record
        return deleteError == null && (count ?? 0) > 0;
    }

    return false;
}

/**
 * Deletes all expired pending verifications
 *
 * @returns Number of deleted records
 */
export async function deleteExpiredVerifications(): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("CustomDomainVerification")
        .delete()
        .eq("status", "PENDING")
        .lt("expiresAt", new Date().toISOString())
        .select();

    if (error) {
        throw new Error(`Failed to delete expired verifications: ${error.message}`);
    }

    return data?.length ?? 0;
}

/**
 * Gets the verification info formatted for display
 */
export function formatVerificationInfo(verification: CustomDomainVerification) {
    return {
        id: verification.id,
        domain: verification.domain,
        status: verification.status,
        setupStep: verification.setupStep,
        verificationRecord: {
            type: "TXT" as const,
            host: getVerificationHost(verification.domain),
            value: verification.verificationValue
        },
        createdAt: new Date(verification.createdAt),
        expiresAt: new Date(verification.expiresAt),
        verifiedAt: verification.verifiedAt ? new Date(verification.verifiedAt) : null
    };
}

/**
 * Updates the setup step for a domain
 */
export async function updateSetupStep(
    id: string,
    setupStep: CustomDomainVerification["setupStep"]
): Promise<CustomDomainVerification> {
    const supabase = getSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("CustomDomainVerification")
        .update({ setupStep })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update setup step: ${error.message}`);
    }

    return data as unknown as CustomDomainVerification;
}

import type { CustomDomainVerificationRow, DomainSetupStep, DomainVerificationStatus } from "../supabase";

export type { CustomDomainVerificationRow, DomainSetupStep, DomainVerificationStatus };

// Alias for easier usage
export type CustomDomainVerification = CustomDomainVerificationRow;

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export interface DnsLookupResult {
    success: boolean;
    records?: string[];
    error?: string;
}

export interface VercelDomainResult {
    success: boolean;
    domain?: string;
    domainId?: string;
    verification?: Array<{
        type: string;
        domain: string;
        value: string;
    }>;
    error?: string;
}

export interface VercelDnsRecord {
    type: "A" | "AAAA" | "CNAME" | "TXT";
    name: string;
    value: string;
}

export interface VercelDomainConfig {
    configuredBy: "CNAME" | "A" | "http" | null;
    misconfigured: boolean;
    dnsRecords: VercelDnsRecord[];
    error?: string;
}

export interface CustomDomainInfo {
    id: string;
    domain: string;
    status: DomainVerificationStatus;
    setupStep: DomainSetupStep | null;
    verificationRecord: {
        type: "TXT";
        host: string;
        value: string;
    };
    dnsRecords?: VercelDnsRecord[];
    createdAt: Date;
    expiresAt: Date;
    verifiedAt: Date | null;
}

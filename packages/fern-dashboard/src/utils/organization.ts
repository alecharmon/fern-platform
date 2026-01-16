import { v4 as uuidv4 } from "uuid";

export function validateOrganizationId(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
        return "Organization ID is required.";
    }
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
        return "Use lowercase letters, numbers, and hyphens only.";
    }
    if (/--/.test(trimmed)) {
        return "Consecutive hyphens are not allowed.";
    }
    if (/^-|-$/.test(trimmed)) {
        return "Cannot start or end with a hyphen.";
    }
    return undefined;
}

export function sanitizePrefillOrgName(rawValue: string | string[] | undefined): string | undefined {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    return trimmed.slice(0, 100);
}

export function validateOrganizationName(value: string): string | undefined {
    if (!value.trim()) {
        return "Organization name is required.";
    }
    return undefined;
}

export function slugifyOrganizationName(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function sanitizeOrgIdInput(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function generateRandomHash(): string {
    const uuidSegment = uuidv4().replace(/-/g, "").slice(0, 12);
    const numericValue = parseInt(uuidSegment, 16);
    return (numericValue % 1_000_000).toString().padStart(6, "0");
}

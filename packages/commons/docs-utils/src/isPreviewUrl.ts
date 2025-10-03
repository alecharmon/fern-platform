export function isPreviewDomain(domain: string): boolean {
    // Accepts org-preview-<uuid-or-truncated-uuid>.docs.buildwithfern.com
    // The uuid part can be truncated, so allow trailing dash and partial uuid
    const previewUuidPattern = /preview-[0-9a-f-]+/i;
    const hasPattern = previewUuidPattern.test(domain);
    return hasPattern;
}

export function extractOrgFromPreview(domain: string): string | undefined {
    const orgRegex = "^[a-zA-Z0-9-]+";
    const uuidRegex = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
    const match = new RegExp(`^(${orgRegex})-preview-${uuidRegex}\\.docs\\.buildwithfern\\.com$`).exec(domain);
    return match ? match[1] : undefined;
}

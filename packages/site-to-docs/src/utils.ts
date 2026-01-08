/**
 * Validates an organization name.
 * Only allows alphanumeric characters, hyphens, and underscores.
 *
 * @param name - The organization name to validate
 * @throws Error if the name is invalid
 */
export function validateOrganizationName(name: string): void {
    if (!name || name.length === 0) {
        throw new Error("Organization name cannot be empty");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw new Error(
            `Invalid organization name "${name}". Only alphanumeric characters, hyphens, and underscores are allowed.`
        );
    }
}

/**
 * Validates a site ID.
 * Only allows alphanumeric characters, hyphens, and underscores.
 *
 * @param siteId - The site ID to validate
 * @throws Error if the site ID is invalid
 */
export function validateSiteId(siteId: string): void {
    if (!siteId || siteId.length === 0) {
        throw new Error("Site ID cannot be empty");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(siteId)) {
        throw new Error(
            `Invalid site ID "${siteId}". Only alphanumeric characters, hyphens, and underscores are allowed.`
        );
    }
}

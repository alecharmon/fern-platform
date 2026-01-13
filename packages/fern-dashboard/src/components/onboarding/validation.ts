/**
 * Shared validation utilities for docs onboarding forms
 */

/**
 * Converts a site name to a URL-friendly subdomain
 */
export function nameToUrl(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, ""); // Remove any non-alphanumeric characters except hyphens
}

/**
 * Validates the docs site name field
 */
export function validateDocsSiteName(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
        return "Site title is required.";
    }
    return undefined;
}

/**
 * Validates the docs site URL/subdomain field
 */
export function validateDocsSiteUrl(value: string, available?: boolean | null): string | undefined {
    if (!value) {
        return "Subdomain is required.";
    }
    if (value.length > 63) {
        return "Subdomain must be 63 characters or fewer.";
    }
    if (!/^[a-z0-9-_]+$/.test(value)) {
        return "Use lowercase letters, numbers, underscores,and hyphens only.";
    }
    if (/--/.test(value)) {
        return "Consecutive hyphens are not allowed.";
    }
    if (/^[-_]|[-_]$/.test(value)) {
        return "Cannot start or end with a hyphen or underscore.";
    }
    if (available === false) {
        return "This URL is not available.";
    }
    return undefined;
}

/**
 * Validates the primary color hex code field
 */
export function validatePrimaryColor(value: string | null): string | undefined {
    if (!value || value.length === 0) {
        return "Primary color is required.";
    }
    if (!/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(value)) {
        return "Invalid color hex code.";
    }
    return undefined;
}

/**
 * Validates OpenAPI spec files
 */
export function validateOpenApiSpecFiles(files: File[]): string | undefined {
    if (!files || files.length === 0) {
        return "Add at least one API spec. Use the default if you don't have one yet.";
    }
    return undefined;
}

/**
 * Validates all form fields for docs onboarding
 */
export function validateWizardForm(data: {
    docsSiteName: string;
    docsSiteUrl: string;
    docsSiteUrlAvailable: boolean | null;
    primaryColorHex: string | null;
    openApiSpecFiles?: File[];
}): {
    docsSiteName?: string;
    docsSiteUrl?: string;
    primaryColorHex?: string;
    openApiSpecFiles?: string;
} {
    const errors: {
        docsSiteName?: string;
        docsSiteUrl?: string;
        primaryColorHex?: string;
        openApiSpecFiles?: string;
    } = {};

    const nameError = validateDocsSiteName(data.docsSiteName);
    if (nameError) {
        errors.docsSiteName = nameError;
    }

    const urlError = validateDocsSiteUrl(data.docsSiteUrl, data.docsSiteUrlAvailable);
    if (urlError) {
        errors.docsSiteUrl = urlError;
    }

    const colorError = validatePrimaryColor(data.primaryColorHex);
    if (colorError) {
        errors.primaryColorHex = colorError;
    }

    if (data.openApiSpecFiles !== undefined) {
        const specError = validateOpenApiSpecFiles(data.openApiSpecFiles);
        if (specError) {
            errors.openApiSpecFiles = specError;
        }
    }

    return errors;
}

import yaml from "js-yaml";

import { findDocsYmlFilePath } from "./docs-yml-colors";

export interface DocsYmlSettings {
    title: string | null;
    favicon: string | null;
    logo: string | null;
}

export const EMPTY_DOCS_YML_SETTINGS: DocsYmlSettings = {
    title: null,
    favicon: null,
    logo: null
};

export function parseSettingsFromYml(content: string): DocsYmlSettings {
    const settings: DocsYmlSettings = { ...EMPTY_DOCS_YML_SETTINGS };

    try {
        const parsed = yaml.load(content) as Record<string, unknown>;
        if (!parsed) {
            return settings;
        }

        if (typeof parsed.title === "string") {
            settings.title = parsed.title;
        }

        if (typeof parsed.favicon === "string") {
            settings.favicon = parsed.favicon;
        }

        const logoSection = parsed.logo as Record<string, unknown> | string | undefined;
        if (typeof logoSection === "string") {
            settings.logo = logoSection;
        } else if (logoSection) {
            settings.logo = (logoSection.dark as string) ?? (logoSection.light as string) ?? null;
        }
    } catch {
        // ignore parse errors
    }

    return settings;
}

export function updateTitleInYml(content: string, title: string): string {
    try {
        const parsed = yaml.load(content) as Record<string, unknown>;
        if (!parsed) {
            return content;
        }

        if (title.trim()) {
            parsed.title = title;
        } else {
            delete parsed.title;
        }

        return yaml.dump(parsed, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    } catch {
        return content;
    }
}

export function updateFaviconInYml(content: string, faviconPath: string): string {
    try {
        const parsed = yaml.load(content) as Record<string, unknown>;
        if (!parsed) {
            return content;
        }

        parsed.favicon = faviconPath;

        return yaml.dump(parsed, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    } catch {
        return content;
    }
}

export function removeFaviconFromYml(content: string): string {
    try {
        const parsed = yaml.load(content) as Record<string, unknown>;
        if (!parsed) {
            return content;
        }

        delete parsed.favicon;

        return yaml.dump(parsed, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    } catch {
        return content;
    }
}

export function updateLogoInYml(content: string, logoPath: string): string {
    try {
        const parsed = yaml.load(content) as Record<string, unknown>;
        if (!parsed) {
            return content;
        }

        const existingLogo = parsed.logo as Record<string, unknown> | string | undefined;
        if (typeof existingLogo === "object" && existingLogo != null) {
            existingLogo.dark = logoPath;
            existingLogo.light = logoPath;
            parsed.logo = existingLogo;
        } else {
            parsed.logo = { dark: logoPath, light: logoPath };
        }

        return yaml.dump(parsed, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    } catch {
        return content;
    }
}

export function removeLogoFromYml(content: string): string {
    try {
        const parsed = yaml.load(content) as Record<string, unknown>;
        if (!parsed) {
            return content;
        }

        delete parsed.logo;

        return yaml.dump(parsed, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    } catch {
        return content;
    }
}

export { findDocsYmlFilePath };

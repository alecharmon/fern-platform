import { parseDocument } from "yaml";

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

const STRINGIFY_OPTIONS = {
    lineWidth: 0,
    defaultKeyType: "PLAIN" as const,
    defaultStringType: "PLAIN" as const
};

export function parseSettingsFromYml(content: string): DocsYmlSettings {
    const settings: DocsYmlSettings = { ...EMPTY_DOCS_YML_SETTINGS };

    try {
        const doc = parseDocument(content);
        const parsed = doc.toJS() as Record<string, unknown>;
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
        const doc = parseDocument(content);

        if (title.trim()) {
            doc.setIn(["title"], title);
        } else {
            doc.deleteIn(["title"]);
        }

        return doc.toString(STRINGIFY_OPTIONS);
    } catch {
        return content;
    }
}

export function updateFaviconInYml(content: string, faviconPath: string): string {
    try {
        const doc = parseDocument(content);
        doc.setIn(["favicon"], faviconPath);
        return doc.toString(STRINGIFY_OPTIONS);
    } catch {
        return content;
    }
}

export function removeFaviconFromYml(content: string): string {
    try {
        const doc = parseDocument(content);
        doc.deleteIn(["favicon"]);
        return doc.toString(STRINGIFY_OPTIONS);
    } catch {
        return content;
    }
}

export function updateLogoInYml(content: string, logoPath: string): string {
    try {
        const doc = parseDocument(content);
        const parsed = doc.toJS() as Record<string, unknown>;
        if (!parsed) {
            return content;
        }

        const existingLogo = parsed.logo as Record<string, unknown> | string | undefined;
        if (typeof existingLogo === "object" && existingLogo != null) {
            doc.setIn(["logo", "dark"], logoPath);
            doc.setIn(["logo", "light"], logoPath);
        } else {
            doc.setIn(["logo"], { dark: logoPath, light: logoPath });
        }

        return doc.toString(STRINGIFY_OPTIONS);
    } catch {
        return content;
    }
}

export function removeLogoFromYml(content: string): string {
    try {
        const doc = parseDocument(content);
        doc.deleteIn(["logo"]);
        return doc.toString(STRINGIFY_OPTIONS);
    } catch {
        return content;
    }
}

export { findDocsYmlFilePath };

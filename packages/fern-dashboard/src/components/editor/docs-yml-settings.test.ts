import { describe, expect, it } from "vitest";

import {
    parseSettingsFromYml,
    removeFaviconFromYml,
    removeLogoFromYml,
    updateFaviconInYml,
    updateLogoInYml,
    updateTitleInYml
} from "./docs-yml-settings";

describe("docs-yml-settings", () => {
    describe("parseSettingsFromYml", () => {
        it("parses title, favicon, and logo", () => {
            const yml = `title: My Docs
favicon: ./assets/favicon.png
logo:
  dark: ./assets/logo-dark.png
  light: ./assets/logo-light.png
`;
            const settings = parseSettingsFromYml(yml);
            expect(settings.title).toBe("My Docs");
            expect(settings.favicon).toBe("./assets/favicon.png");
            expect(settings.logo).toBe("./assets/logo-dark.png");
        });

        it("returns defaults for empty content", () => {
            const settings = parseSettingsFromYml("");
            expect(settings.title).toBeNull();
            expect(settings.favicon).toBeNull();
            expect(settings.logo).toBeNull();
        });

        it("handles string logo", () => {
            const yml = `logo: ./assets/logo.png`;
            const settings = parseSettingsFromYml(yml);
            expect(settings.logo).toBe("./assets/logo.png");
        });
    });

    describe("updateTitleInYml", () => {
        it("updates title while preserving comments", () => {
            const yml = `# Site configuration
title: Old Title
# Navigation settings
navigation:
  - page: Home
`;
            const result = updateTitleInYml(yml, "New Title");
            expect(result).toContain("# Site configuration");
            expect(result).toContain("title: New Title");
            expect(result).toContain("# Navigation settings");
        });

        it("removes title when empty string provided", () => {
            const yml = `title: Old Title
navigation:
  - page: Home
`;
            const result = updateTitleInYml(yml, "  ");
            expect(result).not.toContain("title:");
            expect(result).toContain("navigation:");
        });

        it("preserves inline comments", () => {
            const yml = `title: Old Title # doc title
favicon: ./favicon.png # site icon
`;
            const result = updateTitleInYml(yml, "New Title");
            expect(result).toContain("# doc title");
            expect(result).toContain("# site icon");
        });
    });

    describe("updateFaviconInYml", () => {
        it("updates favicon while preserving comments", () => {
            const yml = `# Main config
title: My Docs
# Favicon path
favicon: ./old-favicon.png
`;
            const result = updateFaviconInYml(yml, "./new-favicon.png");
            expect(result).toContain("# Main config");
            expect(result).toContain("# Favicon path");
            expect(result).toContain("favicon: ./new-favicon.png");
        });

        it("adds favicon to yml without one", () => {
            const yml = `title: My Docs
`;
            const result = updateFaviconInYml(yml, "./favicon.png");
            expect(result).toContain("favicon: ./favicon.png");
        });
    });

    describe("removeFaviconFromYml", () => {
        it("removes favicon while preserving comments", () => {
            const yml = `# Site settings
title: My Docs
favicon: ./favicon.png
# Navigation
navigation:
  - page: Home
`;
            const result = removeFaviconFromYml(yml);
            expect(result).toContain("# Site settings");
            expect(result).not.toContain("favicon:");
            expect(result).toContain("# Navigation");
            expect(result).toContain("title: My Docs");
        });
    });

    describe("updateLogoInYml", () => {
        it("updates existing object logo while preserving comments", () => {
            const yml = `# Branding
logo:
  dark: ./old-dark.png
  light: ./old-light.png
# Other settings
title: My Docs
`;
            const result = updateLogoInYml(yml, "./new-logo.png");
            expect(result).toContain("# Branding");
            expect(result).toContain("# Other settings");
            expect(result).toContain("dark: ./new-logo.png");
            expect(result).toContain("light: ./new-logo.png");
        });

        it("replaces string logo with object logo", () => {
            const yml = `logo: ./old-logo.png
title: My Docs
`;
            const result = updateLogoInYml(yml, "./new-logo.png");
            expect(result).toContain("dark: ./new-logo.png");
            expect(result).toContain("light: ./new-logo.png");
        });
    });

    describe("removeLogoFromYml", () => {
        it("removes logo while preserving comments", () => {
            const yml = `# Header
title: My Docs
# Logo section
logo:
  dark: ./dark.png
  light: ./light.png
# Footer
navigation:
  - page: Home
`;
            const result = removeLogoFromYml(yml);
            expect(result).toContain("# Header");
            expect(result).not.toContain("logo:");
            expect(result).toContain("# Footer");
            expect(result).toContain("title: My Docs");
        });
    });

    describe("comment preservation across operations", () => {
        it("preserves all comments through multiple updates", () => {
            const yml = `# yaml-language-server: $schema=https://schema.buildwithfern.dev/docs-yml.json

# Site title
title: Original Title
# Site favicon
favicon: ./original-favicon.png
# Logo configuration
logo:
  dark: ./original-dark.png
  light: ./original-light.png
# Navigation tree
navigation:
  - page: Home
`;
            let content = yml;

            content = updateTitleInYml(content, "Updated Title");
            expect(content).toContain("# Site title");
            expect(content).toContain("# Site favicon");
            expect(content).toContain("# Logo configuration");
            expect(content).toContain("# Navigation tree");

            content = updateFaviconInYml(content, "./updated-favicon.png");
            expect(content).toContain("# Site title");
            expect(content).toContain("# Site favicon");
            expect(content).toContain("# Logo configuration");
            expect(content).toContain("# Navigation tree");

            content = updateLogoInYml(content, "./updated-logo.png");
            expect(content).toContain("# Site title");
            expect(content).toContain("# Site favicon");
            expect(content).toContain("# Logo configuration");
            expect(content).toContain("# Navigation tree");

            expect(content).toContain("title: Updated Title");
            expect(content).toContain("favicon: ./updated-favicon.png");
            expect(content).toContain("dark: ./updated-logo.png");
        });

        it("preserves block comments spanning multiple lines", () => {
            const yml = `# This is a multi-line
# block comment describing
# the configuration
title: My Docs
favicon: ./favicon.png
`;
            const result = updateTitleInYml(yml, "New Title");
            expect(result).toContain("# This is a multi-line");
            expect(result).toContain("# block comment describing");
            expect(result).toContain("# the configuration");
        });
    });
});

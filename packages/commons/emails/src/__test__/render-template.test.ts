import { describe, expect, it } from "vitest";
import { renderTemplate } from "../render-template";
import type { EmailTemplate } from "../types";

/**
 * Every template type MUST have a fixture here.
 * Adding a new type to `EmailTemplate` without an entry will cause a compile error.
 */
const allTemplatesByType: Record<EmailTemplate["type"], EmailTemplate> = {
    "pdf-export-complete": {
        type: "pdf-export-complete",
        props: {
            userFirstName: "Jane",
            docsSiteUrl: "acme.docs.buildwithfern.com",
            exportTimestamp: new Date("2026-02-14T13:05:00Z"),
            downloadUrl: "https://example.com/download/test.pdf",
            downloadUrlExpiresInHours: 12
        }
    }
};

describe.each(Object.entries(allTemplatesByType))("renderTemplate — %s", (type, template) => {
    it("should correctly render the HTML", async () => {
        const { html } = await renderTemplate(template);
        await expect(html).toMatchFileSnapshot(`__snapshots__/${type}.html`);
    });
});

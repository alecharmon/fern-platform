import { describe, expect, it } from "vitest";

import { applyTocPageNumbers } from "../toc-page-numbers-client";

describe("applyTocPageNumbers", () => {
    it("fills page numbers and marks TOC hydrated", () => {
        document.body.innerHTML = `
            <div data-fern-print-toc-page>
                <span data-fern-toc-page data-fern-slug="intro"></span>
                <span data-fern-toc-page data-fern-slug="guide"></span>
            </div>
        `;

        applyTocPageNumbers([
            ["intro", 1],
            ["guide", 12]
        ]);

        const intro = document.querySelector<HTMLElement>('[data-fern-toc-page][data-fern-slug="intro"]');
        const guide = document.querySelector<HTMLElement>('[data-fern-toc-page][data-fern-slug="guide"]');
        const root = document.querySelector<HTMLElement>("[data-fern-print-toc-page]");

        expect(intro?.textContent).toBe("1");
        expect(guide?.textContent).toBe("12");
        expect(root?.getAttribute("data-fern-toc-hydrated")).toBe("true");
    });
});

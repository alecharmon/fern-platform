import { describe, expect, it } from "vitest";
import { scopeCss } from "./scope-css";

const SCOPE = "#preview-container";

describe("scopeCss", () => {
    describe("document-level selectors", () => {
        it("transforms :root to scope selector", () => {
            const input = `:root { --color: red; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} {`);
        });

        it("transforms :root with descendant selectors", () => {
            const input = `:root [data-body-theme="canvas"] .canvas-wrapper { background: white; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} [data-body-theme="canvas"] .canvas-wrapper`);
        });

        it("transforms html selector", () => {
            const input = `html { scrollbar-color: var(--Foreground2) transparent; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} [data-fern-html]`);
        });

        it("transforms html, main combined selector", () => {
            const input = `html, main { background-color: var(--bg); }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} [data-fern-html]`);
            expect(result).toContain(`${SCOPE} main`);
        });

        it("transforms body selector", () => {
            const input = `body { overflow: hidden; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} [data-fern-body]`);
        });

        it("transforms main selector", () => {
            const input = `main { padding: 20px; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} main`);
        });
    });

    describe("theme selectors", () => {
        it("transforms :is(.dark) selector", () => {
            const input = `:is(.dark) .fern-header-logo-container span { color: #FFFFFF; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`.dark ${SCOPE} .fern-header-logo-container span`);
        });

        it("transforms :is(.light) selector", () => {
            const input = `:is(.light) .fern-button.filled.gradient { background-color: black; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`.light ${SCOPE} .fern-button.filled.gradient`);
        });

        it("transforms .dark selector", () => {
            const input = `.dark .landing .hero { background-image: url('bg.png'); }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`.dark ${SCOPE} .landing .hero`);
        });
    });

    describe("regular selectors", () => {
        it("scopes class selectors", () => {
            const input = `.canvas-wrapper { display: flex; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} .canvas-wrapper`);
        });

        it("scopes ID selectors", () => {
            const input = `#fern-header { border-color: transparent; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} #fern-header`);
        });

        it("scopes descendant selectors", () => {
            const input = `.fern-header-logo-container span { color: #000000; }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`${SCOPE} .fern-header-logo-container span`);
        });
    });

    describe("at-rules", () => {
        it("scopes selectors inside @media queries", () => {
            const input = `@media (width < 48rem) { .canvas-wrapper { margin-left: 0; } }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`@media (width < 48rem)`);
            expect(result).toContain(`${SCOPE} .canvas-wrapper`);
        });

        it("preserves @keyframes without scoping", () => {
            const input = `@keyframes animate-gradient { 0% { background-position: 0% 50%; } }`;
            const result = scopeCss(input, { scopeSelector: SCOPE });
            expect(result).toContain(`@keyframes animate-gradient`);
            expect(result).not.toContain(`${SCOPE} 0%`);
        });
    });

    describe("multiple scope selectors", () => {
        it("applies all scope selectors", () => {
            const input = `.foo { color: red; }`;
            const result = scopeCss(input, {
                scopeSelector: SCOPE,
                additionalScopeSelectors: ["[data-testid=dropdown]"]
            });
            expect(result).toContain(`${SCOPE} .foo`);
            expect(result).toContain(`[data-testid=dropdown] .foo`);
        });
    });
});

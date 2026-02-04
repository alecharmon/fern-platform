/**
 * Transforms CSS selectors to be scoped within a container element.
 * This is needed for the Editor preview where custom CSS needs to be
 * isolated to the preview container without affecting the rest of the page.
 *
 * The editor preview has wrapper divs that mirror the document structure:
 * #preview-container > [data-fern-html] > [data-fern-body] > main
 *
 * Handles special cases:
 * - :root → scopeSelector (CSS variables cascade to descendants)
 * - html → scopeSelector [data-fern-html]
 * - body → scopeSelector [data-fern-body]
 * - main → scopeSelector main (actual element)
 * - .dark/.light at start → .dark/.light scopeSelector
 * - :is(.dark)/:is(.light) → .dark/.light scopeSelector
 * - Regular selectors → scopeSelector selector
 * - color-scheme declarations are stripped (Editor controls theme rendering)
 */

interface ScopeCssOptions {
    scopeSelector: string;
    additionalScopeSelectors?: string[];
}

/**
 * Scopes CSS by transforming selectors to work within a container.
 * Unlike CSS nesting, this properly handles :root, html, body, and theme selectors.
 */
export function scopeCss(css: string, options: ScopeCssOptions): string {
    const { scopeSelector, additionalScopeSelectors = [] } = options;
    const allScopeSelectors = [scopeSelector, ...additionalScopeSelectors];

    const result: string[] = [];
    let i = 0;

    while (i < css.length) {
        // Skip whitespace
        while (i < css.length && /\s/.test(css[i]!)) {
            result.push(css[i]!);
            i++;
        }

        if (i >= css.length) {
            break;
        }

        // Handle comments
        if (css[i] === "/" && css[i + 1] === "*") {
            const commentEnd = css.indexOf("*/", i + 2);
            if (commentEnd === -1) {
                result.push(css.slice(i));
                break;
            }
            result.push(css.slice(i, commentEnd + 2));
            i = commentEnd + 2;
            continue;
        }

        // Handle @rules (media queries, keyframes, supports, etc.)
        if (css[i] === "@") {
            const atRule = parseAtRule(css, i);
            if (atRule) {
                if (atRule.type === "keyframes" || atRule.type === "font-face") {
                    // Don't scope keyframes or font-face rules
                    result.push(atRule.text);
                } else if (atRule.type === "media" || atRule.type === "supports" || atRule.type === "layer") {
                    // Recursively scope the content inside media/supports/layer queries
                    const scopedContent = scopeCss(atRule.content, options);
                    result.push(`${atRule.prelude} {\n${scopedContent}\n}`);
                } else {
                    // Other at-rules (import, charset, etc.) - pass through
                    result.push(atRule.text);
                }
                i = atRule.end;
                continue;
            }
        }

        // Parse a rule (selector + declaration block)
        const rule = parseRule(css, i);
        if (rule) {
            const scopedSelectors = rule.selectors.map((selector) =>
                scopeSelector_internal(selector.trim(), allScopeSelectors)
            );
            const filteredBlock = stripColorScheme(rule.block);
            result.push(`${scopedSelectors.join(",\n")} ${filteredBlock}`);
            i = rule.end;
            continue;
        }

        // If we can't parse anything, move forward
        result.push(css[i]!);
        i++;
    }

    return result.join("");
}

interface AtRuleResult {
    type: string;
    prelude: string;
    content: string;
    text: string;
    end: number;
}

function parseAtRule(css: string, start: number): AtRuleResult | null {
    if (css[start] !== "@") {
        return null;
    }

    // Find the at-rule name
    let i = start + 1;
    while (i < css.length && /[a-zA-Z-]/.test(css[i]!)) {
        i++;
    }
    const ruleName = css.slice(start + 1, i).toLowerCase();

    // Skip whitespace
    while (i < css.length && /\s/.test(css[i]!)) {
        i++;
    }

    // Find the prelude (everything before { or ;)
    let preludeEnd = i;
    let braceCount = 0;
    let inString = false;
    let stringChar = "";

    while (preludeEnd < css.length) {
        const char = css[preludeEnd]!;

        if (inString) {
            if (char === stringChar && css[preludeEnd - 1] !== "\\") {
                inString = false;
            }
            preludeEnd++;
            continue;
        }

        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            preludeEnd++;
            continue;
        }

        if (char === "{") {
            break;
        }

        if (char === ";") {
            // At-rule without block (like @import, @charset)
            return {
                type: ruleName,
                prelude: css.slice(start, preludeEnd),
                content: "",
                text: css.slice(start, preludeEnd + 1),
                end: preludeEnd + 1
            };
        }

        preludeEnd++;
    }

    if (preludeEnd >= css.length) {
        return null;
    }

    const prelude = css.slice(start, preludeEnd).trim();

    // Find matching closing brace
    let blockEnd = preludeEnd + 1;
    braceCount = 1;
    inString = false;

    while (blockEnd < css.length && braceCount > 0) {
        const char = css[blockEnd]!;

        if (inString) {
            if (char === stringChar && css[blockEnd - 1] !== "\\") {
                inString = false;
            }
            blockEnd++;
            continue;
        }

        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            blockEnd++;
            continue;
        }

        if (char === "{") {
            braceCount++;
        } else if (char === "}") {
            braceCount--;
        }
        blockEnd++;
    }

    const content = css.slice(preludeEnd + 1, blockEnd - 1);

    return {
        type: ruleName,
        prelude,
        content,
        text: css.slice(start, blockEnd),
        end: blockEnd
    };
}

interface RuleResult {
    selectors: string[];
    block: string;
    end: number;
}

function parseRule(css: string, start: number): RuleResult | null {
    let i = start;

    // Find the opening brace, handling strings and parentheses
    let parenCount = 0;
    let bracketCount = 0;
    let inString = false;
    let stringChar = "";

    while (i < css.length) {
        const char = css[i]!;

        if (inString) {
            if (char === stringChar && css[i - 1] !== "\\") {
                inString = false;
            }
            i++;
            continue;
        }

        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            i++;
            continue;
        }

        if (char === "(") {
            parenCount++;
        } else if (char === ")") {
            parenCount--;
        } else if (char === "[") {
            bracketCount++;
        } else if (char === "]") {
            bracketCount--;
        } else if (char === "{" && parenCount === 0 && bracketCount === 0) {
            break;
        }

        i++;
    }

    if (i >= css.length) {
        return null;
    }

    const selectorText = css.slice(start, i).trim();
    if (!selectorText) {
        return null;
    }

    // Split selectors by comma, but not inside parentheses or brackets
    const selectors = splitSelectors(selectorText);

    // Find matching closing brace
    let blockEnd = i + 1;
    let braceCount = 1;
    inString = false;

    while (blockEnd < css.length && braceCount > 0) {
        const char = css[blockEnd]!;

        if (inString) {
            if (char === stringChar && css[blockEnd - 1] !== "\\") {
                inString = false;
            }
            blockEnd++;
            continue;
        }

        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            blockEnd++;
            continue;
        }

        if (char === "{") {
            braceCount++;
        } else if (char === "}") {
            braceCount--;
        }
        blockEnd++;
    }

    const block = css.slice(i, blockEnd);

    return {
        selectors,
        block,
        end: blockEnd
    };
}

function splitSelectors(selectorText: string): string[] {
    const selectors: string[] = [];
    let current = "";
    let parenCount = 0;
    let bracketCount = 0;
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < selectorText.length; i++) {
        const char = selectorText[i]!;

        if (inString) {
            current += char;
            if (char === stringChar && selectorText[i - 1] !== "\\") {
                inString = false;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            current += char;
            continue;
        }

        if (char === "(") {
            parenCount++;
            current += char;
        } else if (char === ")") {
            parenCount--;
            current += char;
        } else if (char === "[") {
            bracketCount++;
            current += char;
        } else if (char === "]") {
            bracketCount--;
            current += char;
        } else if (char === "," && parenCount === 0 && bracketCount === 0) {
            if (current.trim()) {
                selectors.push(current.trim());
            }
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        selectors.push(current.trim());
    }

    return selectors;
}

function scopeSelector_internal(selector: string, scopeSelectors: string[]): string {
    const allScopes = scopeSelectors.join(", ");

    // Handle :root - replace with scope selector (CSS variables cascade to descendants)
    if (selector === ":root") {
        return allScopes;
    }

    // Handle :root followed by other selectors (with space)
    if (selector.startsWith(":root ")) {
        const rest = selector.slice(6).trim();
        return scopeSelectors.map((s) => `${s} ${rest}`).join(",\n");
    }

    // Handle html as standalone selector - map to wrapper div
    if (selector === "html") {
        return scopeSelectors.map((s) => `${s} [data-fern-html]`).join(",\n");
    }

    // Handle body as standalone selector - map to wrapper div
    if (selector === "body") {
        return scopeSelectors.map((s) => `${s} [data-fern-body]`).join(",\n");
    }

    // Handle main as standalone selector - there's an actual <main> inside the preview
    if (selector === "main") {
        return scopeSelectors.map((s) => `${s} main`).join(",\n");
    }

    // Handle selectors starting with html followed by space
    if (selector.startsWith("html ")) {
        const rest = selector.slice(5).trim();
        return scopeSelectors.map((s) => `${s} [data-fern-html] ${rest}`).join(",\n");
    }

    // Handle selectors starting with body followed by space
    if (selector.startsWith("body ")) {
        const rest = selector.slice(5).trim();
        return scopeSelectors.map((s) => `${s} [data-fern-body] ${rest}`).join(",\n");
    }

    // Handle selectors starting with main followed by space
    if (selector.startsWith("main ")) {
        const rest = selector.slice(5).trim();
        return scopeSelectors.map((s) => `${s} main ${rest}`).join(",\n");
    }

    // Handle .dark and .light at the start (theme selectors)
    // These need to stay at the document level but scope the rest
    const themePattern = /^(\.(dark|light))(\s+|$)/;
    const themeMatch = selector.match(themePattern);
    if (themeMatch) {
        const theme = themeMatch[1];
        const rest = selector.slice(themeMatch[0].length).trim();
        if (rest) {
            return scopeSelectors.map((s) => `${theme} ${s} ${rest}`).join(",\n");
        }
        return scopeSelectors.map((s) => `${theme} ${s}`).join(",\n");
    }

    // Handle :is(.dark) and :is(.light) patterns
    const isThemePattern = /^:is\(\.(dark|light)\)(\s+|$)/;
    const isThemeMatch = selector.match(isThemePattern);
    if (isThemeMatch) {
        const theme = `.${isThemeMatch[1]}`;
        const rest = selector.slice(isThemeMatch[0].length).trim();
        if (rest) {
            return scopeSelectors.map((s) => `${theme} ${s} ${rest}`).join(",\n");
        }
        return scopeSelectors.map((s) => `${theme} ${s}`).join(",\n");
    }

    // Default: prepend scope selector
    return scopeSelectors.map((s) => `${s} ${selector}`).join(",\n");
}

/**
 * Strips color-scheme declarations from a CSS block.
 * This allows the Editor to fully control theme rendering via its own color-scheme settings.
 * Without this, customer CSS with `color-scheme: light dark` would make light-dark()
 * respond to system preferences instead of the Editor's theme control.
 */
function stripColorScheme(block: string): string {
    // Match color-scheme property declarations (handles various whitespace patterns)
    // Matches: color-scheme: light; or color-scheme: dark; or color-scheme: light dark; etc.
    return block.replace(/\s*color-scheme\s*:\s*[^;]+;\s*/gi, " ");
}

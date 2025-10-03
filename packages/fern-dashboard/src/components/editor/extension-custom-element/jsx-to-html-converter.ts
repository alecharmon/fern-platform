/**
 * Utility for converting JSX-like content to HTML
 */

const VOID_ELEMENTS = [
    "img",
    "input",
    "br",
    "hr",
    "meta",
    "link",
    "area",
    "base",
    "col",
    "embed",
    "source",
    "track",
    "wbr"
];

const BOOLEAN_ATTRIBUTES = [
    "noZoom",
    "disabled",
    "readonly",
    "required",
    "checked",
    "selected",
    "autoplay",
    "controls",
    "loop",
    "muted",
    "playsinline"
];

const HTML_TAGS = [
    "div",
    "img",
    "video",
    "span",
    "p",
    "a",
    "button",
    "input",
    "form",
    "table",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "style"
];

/**
 * Extracts CSS from JSX-style <style>{`css`}</style> tags and returns cleaned content.
 */
function extractCSSFromStyleTags(jsxContent: string): {
    content: string;
    css: string[];
} {
    const cssMatches = jsxContent.match(/<style>\s*{\s*`([\s\S]*?)`\s*}\s*<\/style>/g);
    const extractedCSS: string[] = [];

    if (cssMatches) {
        cssMatches.forEach((match) => {
            const cssContent = match.match(/<style>\s*{\s*`([\s\S]*?)`\s*}\s*<\/style>/);
            if (cssContent?.[1]) {
                extractedCSS.push(cssContent[1]);
            }
        });
    }

    const contentWithoutStyles = jsxContent.replace(/<style>\s*{\s*`[\s\S]*?`\s*}\s*<\/style>/g, "");
    return { content: contentWithoutStyles, css: extractedCSS };
}

/**
 * Converts camelCase CSS properties to kebab-case format.
 * ex: backgroundColor -> background-color
 */
function camelToKebabCase(str: string): string {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Converts JSX style objects to CSS strings.
 * ex: { backgroundColor: "red", fontSize: "16px" } -> background-color: red; font-size: 16px;
 */
function convertStyleObjects(content: string): string {
    return content.replace(/style=\{\{([^}]+)\}\}/g, (match, styleContent) => {
        const styles = styleContent
            .split(",")
            .map((style: string) => style.trim())
            .filter((style: string) => style.includes(":"))
            .map((style: string) => {
                const [property, value] = style.split(":").map((s: string) => s.trim());
                if (!property || !value) return "";
                const cssProperty = camelToKebabCase(property);
                const cssValue = value.replace(/['"]/g, "").replace(/;$/, "");
                return `${cssProperty}: ${cssValue}`;
            })
            .filter(Boolean)
            .join("; ");

        return `style="${styles}"`;
    });
}

/**
 * Converts JSX self-closing tags to proper HTML format.
 */
function handleSelfClosingTags(content: string): string {
    return content.replace(/<(\w+)([^>]*)\s*\/>/g, (match, tagName, attributes) => {
        if (VOID_ELEMENTS.includes(tagName.toLowerCase())) {
            return match; // Keep self-closing for void elements
        }
        return `<${tagName}${attributes}></${tagName}>`;
    });
}

/**
 * Converts JSX boolean attributes to proper HTML format.
 */
function convertBooleanAttributes(content: string): string {
    return content
        .replace(/(\w+)=\{true\}/g, "$1")
        .replace(/(\w+)=\{false\}/g, "")
        .replace(new RegExp(`\\b(${BOOLEAN_ATTRIBUTES.join("|")})\\b(?=\\s|>|\\/>)`, "g"), "$1");
}

/**
 * Handles JSX expressions by converting simple variables to text or removing complex expressions.
 */
function convertJSXExpressions(content: string): string {
    return content.replace(/\{([^{}]+)\}/g, (match, expression) => {
        // If it's just a variable name, keep it as text
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expression.trim())) {
            return expression.trim();
        }
        // Otherwise, remove the expression
        return "";
    });
}

/**
 * Normalizes whitespace and formatting.
 */
function cleanupWhitespace(content: string): string {
    return content.replace(/\n\s*/g, "\n").replace(/\s+/g, " ").trim();
}

/**
 * Utility function to chain transformations without global prototypes.
 */
function pipe<T>(value: T, ...transforms: ((val: T) => T)[]): T {
    return transforms.reduce((acc, transform) => transform(acc), value);
}

/**
 * Main conversion function that transforms JSX-like content to HTML.
 */
export function convertJSXToHTML(jsxContent: string): {
    html: string;
    css: string[];
} {
    // Extract CSS from style tags first
    const { content: contentWithoutStyles, css: extractedCSS } = extractCSSFromStyleTags(jsxContent);

    const result = pipe(
        contentWithoutStyles
            // Convert className to class
            .replace(/className=/g, "class=")
            // Convert JSX comments to HTML comments
            .replace(/{\/\*([\s\S]*?)\*\/}/g, "<!--$1-->")
            // Remove JSX spread operator
            .replace(/\.\.\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g, ""),
        convertStyleObjects,
        handleSelfClosingTags,
        convertBooleanAttributes,
        convertJSXExpressions,
        cleanupWhitespace
    );

    return { html: result, css: extractedCSS };
}

/**
 * Determines if content contains JSX syntax.
 */
export function hasJSXSyntax(content: string): boolean {
    return (
        content.includes("className=") ||
        content.includes("style={{") ||
        content.includes("noZoom") ||
        content.includes("{true}") ||
        content.includes("{false}") ||
        content.includes("<style>")
    );
}

/**
 * Determines if content looks like standard HTML.
 */
export function looksLikeHTML(content: string): boolean {
    const trimmed = content.trim();

    if (!trimmed.startsWith("<")) {
        return false;
    }

    // Check if it contains common HTML tags.
    return HTML_TAGS.some((tag) => trimmed.includes(`<${tag}`));
}

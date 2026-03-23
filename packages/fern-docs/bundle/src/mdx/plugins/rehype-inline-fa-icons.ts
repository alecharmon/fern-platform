import { getIconUrl, parseSvg } from "@fern-docs/components/util/fa";
import { CONTINUE, type Hast, isMdxJsxElementHast, type Unified, visit } from "@fern-docs/mdx";

/**
 * Components whose `icon` attribute should be rewritten from an FA icon string
 * (or SVG URL) to the raw SVG markup at build time, so processIconString can
 * inline it via its `startsWith("<")` branch instead of going through the
 * client-side FaIcon / FernSvgIcon fetch.
 */
const ICON_ATTR_REWRITE_ELEMENTS = new Set([
    "Card",
    "CallToAction",
    "Callout",
    "Info",
    "Warning",
    "Success",
    "Error",
    "Note",
    "Tip",
    "Check",
    "Launch"
]);

/**
 * Normalizes raw SVG text for safe inline rendering:
 * - Strips XML declarations and DOCTYPE
 * - Replaces width/height attributes on the <svg> element with 100%/100%
 *   so the SVG fills its container (matching FernSvgIcon behavior)
 * - Trims whitespace
 */
function normalizeSvgForInline(svgText: string): string {
    let svg = svgText.trim();

    // Strip XML declarations (<?xml ...?>)
    svg = svg.replace(/<\?xml[^?]*\?>\s*/g, "");

    // Strip DOCTYPE declarations
    svg = svg.replace(/<!DOCTYPE[^>]*>\s*/gi, "");

    // Replace width and height on the <svg> element with 100% so it
    // fills its container, matching what FernSvgIcon does client-side.
    const svgOpenMatch = svg.match(/(<svg\b)([^>]*)(>)/i);
    if (svgOpenMatch) {
        let attrs = svgOpenMatch[2]!;
        attrs = attrs.replace(/\s+width\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, "");
        attrs = attrs.replace(/\s+height\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, "");
        svg = svg.replace(svgOpenMatch[0], `${svgOpenMatch[1]}${attrs} width="100%" height="100%"${svgOpenMatch[3]}`);
    }

    return svg.trim();
}

/**
 * Checks whether an icon value is a URL pointing to an SVG file.
 * After rehypeFiles has run, `file:` references will have been resolved to URLs.
 */
function isSvgUrl(icon: string): boolean {
    if (!icon.startsWith("http://") && !icon.startsWith("https://")) {
        return false;
    }
    // Strip query string and fragment before checking extension
    const pathPart = icon.split("?")[0]!.split("#")[0]!;
    return pathPart.toLowerCase().endsWith(".svg");
}

/**
 * Resolves icon references during MDX compilation to prevent the
 * flash-of-missing-icon that occurs when icons are fetched client-side via useSWR.
 *
 * Three strategies are used depending on the element and icon type:
 *
 * 1. <Icon icon="fa-..." /> or <Icon icon="https://...svg" /> — the entire element
 *    is replaced with an inline <svg>.
 * 2. <Card icon="fa-..." />, <CallToAction icon="fa-..." /> — the `icon` attribute
 *    value is rewritten from the FA string to the raw SVG markup so that
 *    processIconString can inline it immediately without a client fetch.
 * 3. <Card icon="https://...svg" />, <CallToAction icon="https://...svg" /> —
 *    SVG URL icons (including resolved file: references) are fetched at build
 *    time and inlined as raw SVG markup, avoiding the client-side FernSvgIcon fetch.
 *
 * NOTE: This plugin must run AFTER rehypeFiles so that file: references have
 * already been resolved to their actual URLs.
 */
export const rehypeInlineFaIcons: Unified.Plugin<[], Hast.Root> = () => {
    return async (ast: Hast.Root) => {
        // Collected <Icon> elements — will have the entire node replaced with an inline <svg>
        const iconNodes: {
            node: Hast.Root["children"][number] & { type: "mdxJsxFlowElement" | "mdxJsxTextElement" };
            index: number;
            parent: Hast.Root | (Hast.Root["children"][number] & { children: Hast.Root["children"] });
            iconValue: string;
            sizeValue: number;
            className?: string;
            color?: string;
            darkModeColor?: string;
            lightModeColor?: string;
        }[] = [];

        // Collected <Card>/<CallToAction> elements — will have their icon attr rewritten
        const iconAttrNodes: {
            node: Hast.Root["children"][number] & { type: "mdxJsxFlowElement" | "mdxJsxTextElement" };
            iconAttr: { type: "mdxJsxAttribute"; name: string; value: unknown };
            iconValue: string;
        }[] = [];

        // First pass: collect all elements with FA icon references
        visit(ast, (node, index, parent) => {
            if (!isMdxJsxElementHast(node) || index == null || parent == null) {
                return CONTINUE;
            }

            const iconAttr = node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "icon");
            const iconValue = iconAttr?.type === "mdxJsxAttribute" ? String(iconAttr.value ?? "") : "";

            if (!iconValue) {
                return CONTINUE;
            }

            const isSvg = isSvgUrl(iconValue);
            const isFa = !isSvg && !iconValue.startsWith("<");

            // Strategy 1: <Icon> elements — FA icons and SVG URLs, collect for full element replacement
            if (node.name === "Icon" && (isFa || isSvg)) {
                const sizeAttr = node.attributes.find(
                    (attr) => attr.type === "mdxJsxAttribute" && attr.name === "size"
                );
                const sizeValue = sizeAttr?.type === "mdxJsxAttribute" ? Number(sizeAttr.value) || 4 : 4;

                const classNameAttr = node.attributes.find(
                    (attr) => attr.type === "mdxJsxAttribute" && attr.name === "className"
                );
                const className =
                    classNameAttr?.type === "mdxJsxAttribute" ? String(classNameAttr.value ?? "") : undefined;

                const colorAttr = node.attributes.find(
                    (attr) => attr.type === "mdxJsxAttribute" && attr.name === "color"
                );
                const color = colorAttr?.type === "mdxJsxAttribute" ? String(colorAttr.value ?? "") : undefined;

                const darkModeColorAttr = node.attributes.find(
                    (attr) => attr.type === "mdxJsxAttribute" && attr.name === "darkModeColor"
                );
                const darkModeColor =
                    darkModeColorAttr?.type === "mdxJsxAttribute" ? String(darkModeColorAttr.value ?? "") : undefined;

                const lightModeColorAttr = node.attributes.find(
                    (attr) => attr.type === "mdxJsxAttribute" && attr.name === "lightModeColor"
                );
                const lightModeColor =
                    lightModeColorAttr?.type === "mdxJsxAttribute" ? String(lightModeColorAttr.value ?? "") : undefined;

                iconNodes.push({
                    node,
                    index,
                    parent: parent as (typeof iconNodes)[number]["parent"],
                    iconValue,
                    sizeValue,
                    className,
                    color,
                    darkModeColor,
                    lightModeColor
                });

                return CONTINUE;
            }

            // Strategy 2 & 3: Card/CallToAction — collect FA icons and SVG URLs for attribute rewriting
            if (ICON_ATTR_REWRITE_ELEMENTS.has(node.name ?? "") && (isFa || isSvg)) {
                iconAttrNodes.push({
                    node,
                    iconAttr: iconAttr as { type: "mdxJsxAttribute"; name: string; value: unknown },
                    iconValue
                });
            }

            return CONTINUE;
        });

        // Collect all unique icon values for fetching
        const allIconValues = [
            ...iconNodes.map(({ iconValue }) => iconValue),
            ...iconAttrNodes.map(({ iconValue }) => iconValue)
        ];

        if (allIconValues.length === 0) {
            return;
        }

        // Deduplicate fetches — multiple elements may reference the same icon
        const uniqueIconValues = [...new Set(allIconValues)];
        const fetchResults = await Promise.allSettled(
            uniqueIconValues.map(async (iconValue) => {
                // Determine fetch URL: SVG URLs are fetched directly, FA icons via CDN
                const url = isSvgUrl(iconValue) ? iconValue : getIconUrl(iconValue);
                if (!url) {
                    return undefined;
                }
                const res = await fetch(url, { cache: "force-cache" });
                if (!res.ok) {
                    return undefined;
                }
                const text = await res.text();
                // For URL SVGs, validate the response is actually SVG content
                if (isSvgUrl(iconValue) && !text.includes("<svg")) {
                    return undefined;
                }
                return text;
            })
        );

        // Build a lookup from icon value to fetched SVG text
        const svgCache = new Map<string, string>();
        for (let i = 0; i < uniqueIconValues.length; i++) {
            const result = fetchResults[i];
            if (result != null && result.status === "fulfilled" && result.value != null) {
                svgCache.set(uniqueIconValues[i]!, result.value);
            }
        }

        // Strategy 1: Replace <Icon> elements with inline <svg>
        for (const entry of iconNodes) {
            const svgText = svgCache.get(entry.iconValue);
            if (svgText == null) {
                continue; // Leave the original <Icon> element for client-side fallback
            }

            const { props: svgProps, body } = parseSvg(svgText);

            if (body == null) {
                continue;
            }

            // For custom SVGs without viewBox, construct one from width/height
            const viewBox =
                svgProps.viewBox ??
                (svgProps.width && svgProps.height ? `0 0 ${svgProps.width} ${svgProps.height}` : undefined);

            const { index, parent, sizeValue, className, color, darkModeColor, lightModeColor } = entry;
            const sizeInPixels = sizeValue * 4;

            // Build the inline style string
            const styleProps: string[] = [`width: ${sizeInPixels}px`, `height: ${sizeInPixels}px`, "overflow: visible"];
            if (lightModeColor ?? color) {
                styleProps.push(`color: ${lightModeColor ?? color}`);
            }
            if (darkModeColor ?? color) {
                styleProps.push(`--fa-icon-dark: ${darkModeColor ?? color}`);
            }

            // Build class name
            const classNames = ["fern-mdx-icon", className].filter(Boolean).join(" ");

            // Replace the <Icon> MDX element with an inline <svg> element.
            // We keep it as an mdxJsxFlowElement so the MDX compiler handles it correctly,
            // using dangerouslySetInnerHTML to inject the SVG body.
            const svgElement = {
                type: "mdxJsxFlowElement" as const,
                name: "svg",
                attributes: [
                    { type: "mdxJsxAttribute" as const, name: "xmlns", value: "http://www.w3.org/2000/svg" },
                    ...(svgProps.prefix
                        ? [{ type: "mdxJsxAttribute" as const, name: "prefix", value: svgProps.prefix }]
                        : []),
                    ...(svgProps.icon
                        ? [{ type: "mdxJsxAttribute" as const, name: "icon", value: svgProps.icon }]
                        : []),
                    ...(viewBox ? [{ type: "mdxJsxAttribute" as const, name: "viewBox", value: viewBox }] : []),
                    { type: "mdxJsxAttribute" as const, name: "aria-hidden", value: "true" },
                    { type: "mdxJsxAttribute" as const, name: "focusable", value: "false" },
                    { type: "mdxJsxAttribute" as const, name: "role", value: "img" },
                    { type: "mdxJsxAttribute" as const, name: "className", value: classNames },
                    {
                        type: "mdxJsxAttribute" as const,
                        name: "style",
                        value: {
                            type: "mdxJsxAttributeValueExpression" as const,
                            value: `{${styleProps
                                .map((p) => {
                                    const [key, ...val] = p.split(":");
                                    const camelKey = key!
                                        .trim()
                                        .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
                                    return `"${camelKey}": "${val.join(":").trim()}"`;
                                })
                                .join(", ")}}`,
                            data: {
                                estree: {
                                    type: "Program" as const,
                                    sourceType: "module" as const,
                                    body: [
                                        {
                                            type: "ExpressionStatement" as const,
                                            expression: {
                                                type: "ObjectExpression" as const,
                                                properties: styleProps.map((p) => {
                                                    const [key, ...val] = p.split(":");
                                                    const camelKey = key!
                                                        .trim()
                                                        .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
                                                    return {
                                                        type: "Property" as const,
                                                        kind: "init" as const,
                                                        computed: false,
                                                        method: false,
                                                        shorthand: false,
                                                        key: { type: "Literal" as const, value: camelKey },
                                                        value: {
                                                            type: "Literal" as const,
                                                            value: val.join(":").trim()
                                                        }
                                                    };
                                                })
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        type: "mdxJsxAttribute" as const,
                        name: "dangerouslySetInnerHTML",
                        value: {
                            type: "mdxJsxAttributeValueExpression" as const,
                            value: `{__html: ${JSON.stringify(body)}}`,
                            data: {
                                estree: {
                                    type: "Program" as const,
                                    sourceType: "module" as const,
                                    body: [
                                        {
                                            type: "ExpressionStatement" as const,
                                            expression: {
                                                type: "ObjectExpression" as const,
                                                properties: [
                                                    {
                                                        type: "Property" as const,
                                                        kind: "init" as const,
                                                        computed: false,
                                                        method: false,
                                                        shorthand: false,
                                                        key: { type: "Identifier" as const, name: "__html" },
                                                        value: { type: "Literal" as const, value: body }
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ],
                children: []
            };

            (parent as { children: Hast.Root["children"] }).children[index] =
                svgElement as unknown as Hast.Root["children"][number];
        }

        // Strategy 2 & 3: Rewrite icon attributes on Card/CallToAction to raw SVG markup.
        // processIconString will see the value starts with "<" and ends with ">"
        // and inline it via dangerouslySetInnerHTML — no client-side FaIcon/FernSvgIcon fetch needed.
        for (const { iconAttr, iconValue } of iconAttrNodes) {
            const svgText = svgCache.get(iconValue);
            if (svgText == null) {
                continue; // Leave original FA string for client-side fallback
            }
            iconAttr.value = normalizeSvgForInline(svgText);
        }
    };
};

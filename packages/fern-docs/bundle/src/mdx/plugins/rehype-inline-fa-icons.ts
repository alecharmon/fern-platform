import { getIconUrl, parseSvg } from "@fern-docs/components/util/fa";
import { CONTINUE, type Hast, isMdxJsxElementHast, type Unified, visit } from "@fern-docs/mdx";

/**
 * Resolves Font Awesome icon references in <Icon icon="fa-regular fa-galaxy" /> elements
 * to inline SVG during MDX compilation. This prevents the flash-of-missing-icon that occurs
 * when icons are fetched client-side via useSWR.
 *
 * The plugin fetches icon SVGs from the FA CDN at build/SSR time and replaces the
 * <Icon> JSX element with a fully resolved <svg> element containing the icon markup.
 */
export const rehypeInlineFaIcons: Unified.Plugin<[], Hast.Root> = () => {
    return async (ast: Hast.Root) => {
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

        // First pass: collect all <Icon> elements with FA icon references
        visit(ast, (node, index, parent) => {
            if (!isMdxJsxElementHast(node) || node.name !== "Icon" || index == null || parent == null) {
                return CONTINUE;
            }

            const iconAttr = node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "icon");
            const iconValue = iconAttr?.type === "mdxJsxAttribute" ? String(iconAttr.value ?? "") : "";

            // Only process FA icons (fa- prefix), not URLs or inline SVGs
            if (!iconValue || !iconValue.includes("fa-")) {
                return CONTINUE;
            }

            const sizeAttr = node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "size");
            const sizeValue = sizeAttr?.type === "mdxJsxAttribute" ? Number(sizeAttr.value) || 4 : 4;

            const classNameAttr = node.attributes.find(
                (attr) => attr.type === "mdxJsxAttribute" && attr.name === "className"
            );
            const className = classNameAttr?.type === "mdxJsxAttribute" ? String(classNameAttr.value ?? "") : undefined;

            const colorAttr = node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "color");
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
        });

        // Second pass: fetch all icons in parallel and replace nodes
        if (iconNodes.length === 0) {
            return;
        }

        const results = await Promise.allSettled(
            iconNodes.map(async ({ iconValue }) => {
                const url = getIconUrl(iconValue);
                if (!url) {
                    return undefined;
                }
                const res = await fetch(url, { cache: "force-cache" });
                if (!res.ok) {
                    return undefined;
                }
                return res.text();
            })
        );

        for (let i = 0; i < iconNodes.length; i++) {
            const result = results[i];
            if (result == null || result.status !== "fulfilled" || result.value == null) {
                continue; // Leave the original <Icon> element for client-side fallback
            }

            const svgText = result.value;
            const { props: svgProps, body } = parseSvg(svgText);

            if (body == null) {
                continue;
            }

            const { index, parent, sizeValue, className, color, darkModeColor, lightModeColor } = iconNodes[i]!;
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
                    ...(svgProps.viewBox
                        ? [{ type: "mdxJsxAttribute" as const, name: "viewBox", value: svgProps.viewBox }]
                        : []),
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
    };
};

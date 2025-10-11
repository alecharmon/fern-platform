import { createHash } from "crypto";
import type { ElementContent, Root as HastRoot } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { type Handle as ToMdastHandle, toMdast, defaultHandlers as toMdastDefaultHandlers } from "hast-util-to-mdast";
import yaml from "js-yaml";
import type { Parents as MdastParents, Nodes, Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown, frontmatterToMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown, mathToMarkdown } from "mdast-util-math";
import { mdxFromMarkdown, mdxToMarkdown } from "mdast-util-mdx";
import {
    type Handler as ToHastHandler,
    type State as ToHastState,
    toHast,
    defaultHandlers as toHastDefaultHandlers
} from "mdast-util-to-hast";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter as fm } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";
import { mdxjs } from "micromark-extension-mdxjs";
import { visit } from "unist-util-visit";

import type { MdxJsxElement } from "./mdast";

// Options for how yaml is written to the frontmatter
const FRONTMATTER_YAML_OPTIONS: yaml.DumpOptions = {
    noRefs: true,
    lineWidth: -1
};

// Mdast dodes that have default handlers
// Note: toHastDefaultHandlers does NOT support math or inlineMath nodes by default
type ToHastDefaultHandlersType = keyof typeof toHastDefaultHandlers;

// Hast nodes that have default handlers
type ToMdastDefaultHandlersType = keyof typeof toMdastDefaultHandlers;

// All mdast node types that toHast can handle (keyof Handlers from mdast-util-to-hast)
// Notes:
// - toHast does NOT support toml by default
// - We must be explicit about the keys here due to an issue with TypeScript inferring the correct types
type AllElementsType =
    | "blockquote"
    | "break"
    | "code"
    | "definition"
    | "delete"
    | "emphasis"
    | "footnoteDefinition"
    | "footnoteReference"
    | "heading"
    | "html"
    | "image"
    | "imageReference"
    | "inlineCode"
    | "link"
    | "linkReference"
    | "list"
    | "listItem"
    | "paragraph"
    | "root"
    | "strong"
    | "table"
    | "tableCell"
    | "tableRow"
    | "text"
    | "thematicBreak"
    | "yaml"
    | "mdxJsxFlowElement"
    | "mdxJsxTextElement"
    | "mdxFlowExpression"
    | "mdxTextExpression"
    | "mdxjsEsm"
    | "math"
    | "inlineMath";

// Nodes we should not treat as custom elements
// Notes:
// - Since toHast does not support math or inlineMath nodes by default, we treat them as custom elements
// - We also treat html nodes as custom elements, since when we encounter them they are usually customer-provided components
type BaseElementsType = Exclude<
    AllElementsType,
    | "mdxJsxFlowElement"
    | "mdxJsxTextElement"
    | "mdxFlowExpression"
    | "mdxTextExpression"
    | "mdxjsEsm"
    | "math"
    | "inlineMath"
    | "html"
    | "image"
    | "imageReference"
>;

// Non-custom nodes that can be hashed
// TODO: ensure that this is comprehensive of all nodes that are not hashable
type HashableBaseElementsType = Exclude<BaseElementsType, "root" | "yaml">;

// Type guard to check if a base element type is hashable
function isHashableBaseElementsType(type: BaseElementsType): type is HashableBaseElementsType {
    return type !== "root" && type !== "yaml";
}

// Nodes to treat as custom elements
type CustomElementsType = Exclude<AllElementsType, BaseElementsType>;

// Hash of a node
export type NodeId = string;

// Map of changed nodes by hash
export type ChangedNodes = Record<NodeId, boolean>;

// Frontmatter included in mdx
/** If MDX does not contain a YAML frontmatter block, frontmatter should be null */
export type Frontmatter = Record<string, unknown> | null;

// Re-export mdast types for external use
export type {
    Content as MdastContent,
    Node as MdastNode,
    Nodes as MdastNodes
} from "mdast";

// Response from mdxToAST
export interface MdxToASTResponse {
    mdast: Root;
    frontmatter: Frontmatter;
    originalFrontmatter?: string;
}

// Response from mdxToHtml
export interface MdxToHtmlResponse {
    html: string;
    frontmatter: Frontmatter;
    originalFrontmatter?: string;
}

interface MdxToHtmlOptions {
    /**
     * Whether to treat an mdast node type as a custom element for now e.g. avoid lossiness in code block "meta" props
     */
    treatAsCustomElement?: BaseElementsType[];
    /**
     * Whether to treat an mdast node type as unsupported for now
     * Note: we will intentionally throw an error if we encounter an unsupported node type
     */
    treatAsUnsupported?: AllElementsType[];
}

// Convert mdx to AST with frontmatter extraction
export function mdxToAST(rootContent: string): MdxToASTResponse {
    // Get mdast from root mdx content
    const mdast = fromMarkdown(rootContent, {
        extensions: [mdxjs(), fm(["yaml"]), math(), gfm()],
        mdastExtensions: [mdxFromMarkdown(), frontmatterFromMarkdown(["yaml"]), mathFromMarkdown(), gfmFromMarkdown()]
    });

    // Get frontmatter from mdast (expects only one frontmatter node)
    const frontmatterNode = mdast.children.find((node) => node.type === "yaml");
    const originalFrontmatter = frontmatterNode?.value;

    // Parse frontmatter from yaml
    const parsedFrontmatter = originalFrontmatter && yaml.load(originalFrontmatter);
    const frontmatter = isValidFrontmatter(parsedFrontmatter) ? parsedFrontmatter : null;

    return { mdast, frontmatter, originalFrontmatter };
}

// Convert AST back to MDX string
export function astToMDX(mdast: Nodes, originalFrontmatter?: string): string {
    // Start with frontmatter if it exists
    let mdxContent = "";

    if (originalFrontmatter) {
        mdxContent = `---\n${originalFrontmatter}\n---\n\n`;
    }

    // Convert mdast back to MDX string
    const mdxBody = toMarkdown(mdast, {
        extensions: [mdxToMarkdown(), frontmatterToMarkdown(["yaml"]), mathToMarkdown(), gfmToMarkdown()]
    });

    mdxContent += mdxBody;

    return mdxContent;
}

// Convert mdx to html, frontmatter, and original elements
export function mdxToHtml(rootContent: string, options?: MdxToHtmlOptions): MdxToHtmlResponse {
    const { treatAsCustomElement = [], treatAsUnsupported = [] } = options ?? {};

    // Get mdast and frontmatter from mdx content
    const { mdast, frontmatter, originalFrontmatter } = mdxToAST(rootContent);

    // Default handler for base elements
    function baseElementHandler(state: ToHastState, node: any, parents?: MdastParents) {
        const { type, name, positionStart, positionEnd } = getNodeInfo(node);
        const nodeType = type as BaseElementsType;

        if (treatAsUnsupported.includes(nodeType)) {
            throw new Error(`Unsupported node type: ${nodeType}`);
        }

        // Special case: if this is a paragraph that contains only images/imageReferences,
        // treat it as a custom element to avoid nested rendering
        if (nodeType === "paragraph" && node.children && Array.isArray(node.children)) {
            const hasOnlyImages = node.children.every(
                (child: any) => child.type === "image" || child.type === "imageReference"
            );
            if (hasOnlyImages && node.children.length > 0) {
                const { content } = getNodeContent(node, rootContent);
                return mdxUnsupportedCustomElementNodev2(
                    generateContentHash(positionStart, positionEnd, content),
                    content
                );
            }
        }

        if (!isHashableBaseElementsType(nodeType)) {
            // Early return if the node is not hashable
            return getToHastDefaultHandler(nodeType)(state, node, parents);
        }
        const { content } = getNodeContent(node, rootContent);
        return mdxBaseElementNode(
            generateContentHash(positionStart, positionEnd, content),
            content,
            nodeType,
            name,
            state,
            node,
            parents
        );
    }

    // Default handler for custom elements
    function customElementHandler(_state: ToHastState, node: any, __?: MdastParents) {
        const { type, name, positionStart, positionEnd } = getNodeInfo(node);

        const nodeType = type as CustomElementsType;
        if (treatAsUnsupported.includes(nodeType)) {
            throw new Error(`Unsupported node type: ${nodeType}`);
        }

        // Handle image-upload custom element
        if (type === "mdxJsxFlowElement" && name === "div") {
            const maybeDataType = node?.attributes?.find((attr: any) => attr.name === "data-type")?.value;
            if (maybeDataType === "image-upload") {
                return {
                    type: "element",
                    tagName: "div",
                    properties: {
                        dataType: "image-upload"
                    }
                };
            }
        }

        const { content } = getNodeContent(node, rootContent);

        return mdxUnsupportedCustomElementNodev2(generateContentHash(positionStart, positionEnd, content), content);
    }

    // Get hast from mdast (and handle custom elements)
    const hast = toHast(mdast, {
        handlers: {
            ...({
                blockquote: baseElementHandler,
                break: baseElementHandler,
                code: baseElementHandler,
                definition: baseElementHandler,
                delete: baseElementHandler,
                emphasis: baseElementHandler,
                footnoteDefinition: baseElementHandler,
                footnoteReference: baseElementHandler,
                heading: baseElementHandler,
                inlineCode: baseElementHandler,
                link: baseElementHandler,
                linkReference: baseElementHandler,
                list: baseElementHandler,
                listItem: baseElementHandler,
                paragraph: baseElementHandler,
                root: baseElementHandler,
                strong: baseElementHandler,
                table: baseElementHandler,
                tableCell: baseElementHandler,
                tableRow: baseElementHandler,
                text: baseElementHandler,
                thematicBreak: baseElementHandler,
                yaml: baseElementHandler
            } as Record<BaseElementsType, ToHastHandler>),
            ...({
                mdxJsxFlowElement: customElementHandler,
                mdxJsxTextElement: customElementHandler,
                mdxFlowExpression: customElementHandler,
                mdxTextExpression: customElementHandler,
                mdxjsEsm: customElementHandler,
                math: customElementHandler,
                inlineMath: customElementHandler,
                html: customElementHandler,
                image: customElementHandler,
                imageReference: customElementHandler,
                ...Object.fromEntries(treatAsCustomElement.map((type) => [type, customElementHandler]))
            } as Record<CustomElementsType, ToHastHandler>)
        }
    });

    // Get html from hast
    const html = toHtml(hast);

    return { html, frontmatter, originalFrontmatter };
}

// Response from htmlToMdx
export interface HtmlToMdxResponse {
    mdx: string;
}

export interface HtmlToMdxOptions {
    /**
     * Frontmatter to include in the mdx
     */
    frontmatter?: Frontmatter;
    /**
     * The original formatting of the frontmatter string
     */
    originalFrontmatter?: string;
    /**
     * Whether consider frontmatter changed; used in conjunction with originalFrontmatter
     */
    changedFrontmatter?: boolean;
    /**
     * Changed nodes in the html
     */
    changedNodes?: ChangedNodes;
}

// Convert html to mdx
// TODO: we might be able to further optimize by refactoring this and getChangedNodesFromHtml
export function htmlToMdx(html: string, options?: HtmlToMdxOptions): HtmlToMdxResponse {
    const { frontmatter, originalFrontmatter, changedFrontmatter, changedNodes } = options ?? {};

    // Get hast from html
    const hast = fromHtml(html);

    const placeholders: Record<string, string> = {};

    // Default handler for base elements
    const baseElementHandler: ToMdastHandle = (state, element) => {
        // Handle image-upload custom element separately
        if (element?.properties?.dataType === "image-upload") {
            return { type: "html", value: `<div data-type="image-upload" />` } as any;
        }

        // Never use encoded mdx attribute for list elements (ul, ol, li) - always regenerate from structure
        // This prevents issues with bullet markers being duplicated or mismatched
        if (element.tagName === "ul" || element.tagName === "ol" || element.tagName === "li") {
            return getToMdastDefaultHandler(element.tagName as any)(state, element);
        }

        // If a node has not been changed, we use the original MDX content
        // BUT only if it doesn't have children with their own encoded mdx attribute (to avoid duplication)
        if (
            changedNodes != null &&
            typeof element.properties?.["fve-mdx-b64"] === "string" &&
            typeof element.properties?.["fve-data-id"] === "string" &&
            !changedNodes[element.properties["fve-data-id"]]
        ) {
            const originalMdx = Buffer.from(element.properties["fve-mdx-b64"], "base64").toString("utf-8");

            const id = Math.random().toString().slice(2, 14);
            const placeholder = `PLACEHOLDERV2_${id}`;
            placeholders[placeholder] = originalMdx;

            return { type: "html", value: placeholder } as any;
        }

        return getToMdastDefaultHandler(element.tagName as any)(state, element);
    };

    const customElementv2Handler: ToMdastHandle = (_, element) => {
        // Parse fve-data-* properties into MDX attributes and extract name/type/hash
        const props = element.properties || {};

        const content = props["fve-mdx-b64"];
        if (typeof content !== "string") {
            throw new Error(`expected string content in fve-mdx-b64, found: ${typeof content}`);
        }

        const originalMdx = Buffer.from(content, "base64").toString("utf-8");
        const id = Math.random().toString().slice(2, 14);
        const placeholder = `PLACEHOLDERV2_${id}`;
        placeholders[placeholder] = originalMdx;

        return { type: "html", value: placeholder } as any;
    };

    // Get mdast from hast (and handle custom elements)
    // TODO: fix types
    const mdast = toMdast(hast, {
        handlers: {
            // All HTML tags that have MDX representations
            // Headings
            h1: baseElementHandler,
            h2: baseElementHandler,
            h3: baseElementHandler,
            h4: baseElementHandler,
            h5: baseElementHandler,
            h6: baseElementHandler,

            // Text formatting
            p: baseElementHandler,
            strong: baseElementHandler,
            b: baseElementHandler,
            em: baseElementHandler,
            i: baseElementHandler,
            del: baseElementHandler,
            s: baseElementHandler,
            strike: baseElementHandler,
            u: baseElementHandler,
            mark: baseElementHandler,
            ins: baseElementHandler,
            small: baseElementHandler,
            big: baseElementHandler,
            blink: baseElementHandler,
            nobr: baseElementHandler,
            span: baseElementHandler,
            font: baseElementHandler,

            // Code and inline code
            code: baseElementHandler,
            tt: baseElementHandler,
            kbd: baseElementHandler,
            samp: baseElementHandler,
            var: baseElementHandler,
            pre: baseElementHandler,
            plaintext: baseElementHandler,
            listing: baseElementHandler,
            xmp: baseElementHandler,

            // Links and references
            a: baseElementHandler,
            q: baseElementHandler,
            cite: baseElementHandler,
            dfn: baseElementHandler,
            abbr: baseElementHandler,
            acronym: baseElementHandler,

            // Lists
            ul: baseElementHandler,
            ol: baseElementHandler,
            dir: baseElementHandler,
            li: baseElementHandler,
            dl: baseElementHandler,
            dt: baseElementHandler,
            dd: baseElementHandler,

            // Tables
            table: baseElementHandler,
            tr: baseElementHandler,
            td: baseElementHandler,
            th: baseElementHandler,

            // Block elements
            blockquote: baseElementHandler,
            hr: baseElementHandler,
            br: baseElementHandler,
            wbr: baseElementHandler,

            // Media
            img: baseElementHandler,
            image: baseElementHandler,
            iframe: baseElementHandler,
            audio: baseElementHandler,
            video: baseElementHandler,

            // Forms and inputs
            input: baseElementHandler,
            textarea: baseElementHandler,
            select: baseElementHandler,
            button: baseElementHandler,
            label: baseElementHandler,
            fieldset: baseElementHandler,
            legend: baseElementHandler,
            form: baseElementHandler,

            // Layout and structure
            div: baseElementHandler,
            section: baseElementHandler,
            article: baseElementHandler,
            aside: baseElementHandler,
            header: baseElementHandler,
            footer: baseElementHandler,
            nav: baseElementHandler,
            main: baseElementHandler,
            body: baseElementHandler,
            html: baseElementHandler,
            address: baseElementHandler,
            center: baseElementHandler,
            hgroup: baseElementHandler,
            multicol: baseElementHandler,
            picture: baseElementHandler,
            figure: baseElementHandler,
            figcaption: baseElementHandler,

            // Other elements
            details: baseElementHandler,
            summary: baseElementHandler,
            data: baseElementHandler,
            time: baseElementHandler,
            bdi: baseElementHandler,
            bdo: baseElementHandler,
            canvas: baseElementHandler,
            map: baseElementHandler,
            object: baseElementHandler,
            param: baseElementHandler,
            embed: baseElementHandler,
            marquee: baseElementHandler,
            meter: baseElementHandler,
            progress: baseElementHandler,
            output: baseElementHandler,
            slot: baseElementHandler,
            noscript: baseElementHandler,
            ruby: baseElementHandler,
            rb: baseElementHandler,
            rbc: baseElementHandler,
            rp: baseElementHandler,
            rt: baseElementHandler,
            rtc: baseElementHandler,
            sup: baseElementHandler,
            sub: baseElementHandler,
            tbody: baseElementHandler,
            thead: baseElementHandler,
            tfoot: baseElementHandler,

            // Custom elements
            ["custom-element-v2"]: customElementv2Handler
        } as any
    });

    // Post-process mdast to compact lists (remove blank lines)
    visit(mdast, "list", (node: any) => {
        node.spread = false;
        if (node.children) {
            node.children.forEach((child: any) => {
                if (child.type === "listItem") {
                    child.spread = false;
                }
            });
        }
    });

    // Get mdx from mdast
    const mdx = toMarkdown(mdast, {
        extensions: [
            mdxToMarkdown(),
            frontmatterToMarkdown(["yaml"]),
            mathToMarkdown({ singleDollarTextMath: false }),
            gfmToMarkdown()
        ],
        // TODO: float configurations up to make them more discoverable
        // Use hyphen for unordered lists (more common in user content)
        bullet: "-",
        // Compact list formatting - don't add blank lines between items
        listItemIndent: "one"
    });

    // Reinject frontmatter if it exists
    let finalMdx = mdx;
    if (changedFrontmatter === false && originalFrontmatter) {
        finalMdx = `---\n${originalFrontmatter}---\n\n${mdx}`;
    } else if (
        frontmatter &&
        // Only include frontmatter if it has at least one defined value
        Object.values(frontmatter).filter((value) => value !== undefined).length > 0
    ) {
        const frontmatterYaml = yaml.dump(frontmatter, FRONTMATTER_YAML_OPTIONS);
        finalMdx = `---\n${frontmatterYaml}---\n\n${mdx}`;
    }

    // Replace placeholders with actual content
    Object.entries(placeholders).forEach(([placeholder, content]) => {
        // Escape dollar signs in content to prevent them from being treated as replacement references
        // In JavaScript string replacement, $ has special meaning:
        // - $& inserts the matched substring
        // - $` inserts the portion of the string that precedes the matched substring
        // - $' inserts the portion of the string that follows the matched substring
        // - $n inserts the nth parenthesized submatch string
        // By doubling the $ ($$), we insert a literal $ character
        const escapedContent = content.replace(/\$/g, "$$$$");
        // Replace all occurrences of the placeholder with the escaped content
        finalMdx = finalMdx.replaceAll(placeholder, escapedContent);
    });

    return { mdx: finalMdx };
}

// Type guard to check if frontmatter is valid
function isValidFrontmatter(frontmatter: unknown): frontmatter is Record<string, unknown> {
    const isValid = !!frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter);
    return isValid;
}

// Get node info in a type-safe way
// TODO: consider writing type guards for the node, since toHast does not type it by default
function getNodeInfo(node: any) {
    if (!node.type || typeof node.type !== "string") {
        throw new Error("mdast node does not have a valid type");
    }
    if (node.name && typeof node.name !== "string") {
        throw new Error("mdast node name is not of type string");
    }
    const positionStart = node.position?.start?.offset;
    const positionEnd = node.position?.end?.offset;
    if (positionStart == null || positionEnd == null) {
        throw new Error("mdast node unexpectedly does not have a position");
    }

    return {
        type: node.type as string,
        name: node.name as string | undefined,
        positionStart: positionStart as number,
        positionEnd: positionEnd as number
    };
}

// Get node content in a type-safe way
// TODO: consider writing type guards for the node, since toHast does not type it by default
function getNodeContent(node: any, rootContent: string) {
    if (node.position?.start.offset == null || node.position?.end.offset == null) {
        throw new Error("Node does not have valid position offset(s)");
    }
    const content = rootContent.slice(node.position.start.offset, node.position.end.offset);

    return { content };
}

// Strip fve- attributes from a node for comparison purposes
function stripNodeAttributes(node: ElementContent): any {
    if (!node || typeof node !== "object") {
        return node;
    }

    if (Array.isArray(node)) {
        return node.map(stripNodeAttributes);
    }

    const stripped = { ...node };

    // Remove only fve- properties (which include attributes in hast nodes)
    if (stripped.type === "element" && stripped.properties) {
        const filteredProperties: Record<string, any> = {};
        for (const [key, value] of Object.entries(stripped.properties)) {
            if (!key.startsWith("fve-")) {
                filteredProperties[key] = value;
            }
        }
        stripped.properties = filteredProperties;
    }
    // Recursively strip attributes from children
    if ("children" in stripped && stripped.children && Array.isArray(stripped.children)) {
        stripped.children = stripped.children.map(stripNodeAttributes);
    }

    return stripped;
}

// TODO: we might be able to further optimize by refactoring this and htmlToMdx
export function getChangedNodesFromHtml(originalHtml: string, latestHtml: string): ChangedNodes {
    const originalHast = fromHtml(originalHtml);
    const latestHast = fromHtml(latestHtml);

    const originalMap = getNodeMapFromHast(originalHast);
    const latestMap = getNodeMapFromHast(latestHast, true); // Remove duplicates for latestMap to ensure content that was split is treated as new and unique

    // Default to all nodes being changed until we can compare them
    const changedNodes: ChangedNodes = {
        ...Object.fromEntries(Object.keys(originalMap).map((id) => [id, true])),
        ...Object.fromEntries(Object.keys(latestMap).map((id) => [id, true]))
    };

    // Compare nodes with the same hash
    for (const id of Object.keys(originalMap)) {
        if (id in latestMap) {
            // Compare the nodes without "fve-" attributes
            const originalNode = originalMap[id];
            const latestNode = latestMap[id];

            if (originalNode == null || latestNode == null) {
                throw new Error(
                    `Node with id "${id}" exists in both maps but one of the nodes is null/undefined. Original: ${originalNode}, Latest: ${latestNode}`
                );
            }

            // Strip attributes from both nodes before comparison
            const strippedOriginal = stripNodeAttributes(originalNode);
            const strippedLatest = stripNodeAttributes(latestNode);

            // Convert to HTML strings for comparison (without attributes)
            const originalContent = toHtml(strippedOriginal);
            const latestContent = toHtml(strippedLatest);

            changedNodes[id] = originalContent !== latestContent;
        }
    }

    return changedNodes;
}

// TODO: consider writing type guards for the hast nodes, since toHast does not type it by default
function getNodeMapFromHast(hast: HastRoot, removeDuplicates: boolean = false) {
    const map: Record<NodeId, ElementContent> = {};
    let bodyChildren: ElementContent[] | undefined;
    if (hast && Array.isArray(hast.children)) {
        // Find the <html> element
        const htmlNode = hast.children.find((node) => node.type === "element" && node.tagName === "html");
        if (htmlNode && htmlNode.type === "element" && Array.isArray(htmlNode.children)) {
            // Find the <body> element inside <html>
            const bodyNode = htmlNode.children.find((node) => node.type === "element" && node.tagName === "body");
            if (bodyNode && bodyNode.type === "element" && Array.isArray(bodyNode.children)) {
                bodyChildren = bodyNode.children;
            }
        }
    }
    if (removeDuplicates) {
        const idArray =
            bodyChildren
                ?.map((node) => (node.type === "element" ? node.properties?.["fve-data-id"] : null))
                .filter(Boolean) ?? [];
        const numUniqueIds = new Set(idArray);

        // If we have any duplicate IDs, we need to regenerate them
        if (numUniqueIds.size !== idArray.length) {
            // Find which IDs are duplicated
            const duplicateIds = new Set<string>();
            const seenIds = new Set<string>();
            for (const id of idArray) {
                if (typeof id === "string") {
                    if (seenIds.has(id)) {
                        duplicateIds.add(id);
                    }
                    seenIds.add(id);
                }
            }

            const regeneratedBodyChildren = bodyChildren?.map((node) => {
                if (
                    node.type === "element" &&
                    node.properties?.["fve-data-id"] &&
                    typeof node.properties["fve-data-id"] === "string" &&
                    duplicateIds.has(node.properties["fve-data-id"])
                ) {
                    // If its a paragraph node, then it will have a text child
                    if (node.children[0]?.type === "text") {
                        // Generate new data-id and fve-mdx-b64 properties
                        return {
                            ...node,
                            properties: {
                                ...node.properties,
                                "fve-data-id": Math.random().toString().slice(2, 14),
                                "fve-mdx-b64": Buffer.from(node.children[0].value, "utf-8").toString("base64")
                            }
                        };
                    }
                }
                return node;
            });
            bodyChildren = regeneratedBodyChildren;
        }
    }

    if (bodyChildren) {
        for (const node of bodyChildren) {
            if (
                node &&
                node.type === "element" &&
                node.properties &&
                typeof node.properties["fve-data-id"] === "string"
            ) {
                map[node.properties["fve-data-id"]] = node;
            }
        }
    }
    return map;
}

// Get the toHast default handler in a type-safe way
function getToHastDefaultHandler(type: ToHastDefaultHandlersType) {
    return toHastDefaultHandlers[type];
}

// Get the toMarkdown default handler in a type-safe way
function getToMdastDefaultHandler(type: ToMdastDefaultHandlersType) {
    return toMdastDefaultHandlers[type];
}

// Create node for a base element
function mdxBaseElementNode(
    id: string,
    content: string,
    type: HashableBaseElementsType,
    __: string | undefined,
    state: ToHastState,
    node: any,
    parents?: MdastParents
) {
    const defaultNode = getToHastDefaultHandler(type)(state, node, parents);
    switch (typeof defaultNode) {
        case "object": {
            if (Array.isArray(defaultNode)) {
                // Expects defaultNode: ElementContent[]
                return defaultNode;
            } else if (defaultNode.type === "element") {
                // Expects defaultNode: Element
                return {
                    ...defaultNode,
                    properties: {
                        ...defaultNode.properties,
                        "fve-data-id": id,
                        "fve-mdx-b64": Buffer.from(content, "utf-8").toString("base64")
                    }
                };
            } else if (defaultNode.type === "comment" || defaultNode.type === "text" || defaultNode.type === "raw") {
                // Expects defaultNode: Comment | Text | Raw
                // Note: these are nodes we don't need to hash, so we return them as is
                return defaultNode;
            } else if (
                defaultNode.type === "root" ||
                defaultNode.type === "mdxTextExpression" ||
                defaultNode.type === "mdxJsxTextElement" ||
                defaultNode.type === "mdxJsxFlowElement" ||
                defaultNode.type === "mdxFlowExpression"
            ) {
                // Expects defaultNode: Root | MdxTextExpressionHast | MdxFlowExpressionHast | MdxJsxFlowElementHast | MdxJsxTextElementHast
                // Note: since we handle these nodes in mdxToHtml, we don't expect to see them here
                console.warn(`Unexpected defaultNode type: ${defaultNode.type}`);
                return defaultNode;
            } else {
                throw new Error(`Unknown defaultNode type: ${defaultNode}`);
            }
        }
        case "undefined":
        default: {
            return defaultNode;
        }
    }
}

// Create node for a custom element -- colton v2 test
function mdxUnsupportedCustomElementNodev2(id: string, originalMdxContent: string) {
    return {
        type: "element" as const,
        tagName: "custom-element-v2",
        // These data attributes help the client to handle the custom element
        properties: {
            "fve-data-id": id,
            "fve-mdx-b64": Buffer.from(originalMdxContent, "utf-8").toString("base64")
        },
        children: []
    };
}

// Generate a random 16-digit number string
function generateContentHash(positionStart: number, positionEnd: number, content: string): string {
    return createHash("sha256").update(`${positionStart}_${positionEnd}_${content}`).digest("hex");
}

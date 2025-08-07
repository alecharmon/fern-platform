import { createHash } from "crypto";
import { Root as HastRoot } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import {
  Handle as ToMdastHandle,
  toMdast,
  defaultHandlers as toMdastDefaultHandlers,
} from "hast-util-to-mdast";
import yaml from "js-yaml";
import { Parents as MdastParents } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import {
  frontmatterFromMarkdown,
  frontmatterToMarkdown,
} from "mdast-util-frontmatter";
import { mathFromMarkdown, mathToMarkdown } from "mdast-util-math";
import { mdxFromMarkdown, mdxToMarkdown } from "mdast-util-mdx";
import {
  Handler as ToHastHandler,
  State as ToHastState,
  toHast,
  defaultHandlers as toHastDefaultHandlers,
} from "mdast-util-to-hast";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter as fm } from "micromark-extension-frontmatter";
import { math } from "micromark-extension-math";
import { mdxjs } from "micromark-extension-mdxjs";

// Options for how yaml is written to the frontmatter
const FRONTMATTER_YAML_OPTIONS: yaml.DumpOptions = {
  noRefs: true,
  lineWidth: -1,
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
>;

// Non-custom nodes that can be hashed
// TODO: ensure that this is comprehensive of all nodes that are not hashable
type HashableBaseElementsType = Exclude<BaseElementsType, "root" | "yaml">;

// Type guard to check if a base element type is hashable
function isHashableBaseElementsType(
  type: BaseElementsType
): type is HashableBaseElementsType {
  return type !== "root" && type !== "yaml";
}

// Nodes to treat as custom elements
type CustomElementsType = Exclude<AllElementsType, BaseElementsType>;

// Hash of a node
export type NodeHash = string;

// Original element data
export interface OriginalElement {
  type: string;
  name?: string;
  content: string;
}

// Map of original elements by hash
export type OriginalElements = Record<NodeHash, OriginalElement>;

// Map of changed nodes by hash
export type ChangedNodes = Record<NodeHash, boolean>;

// Frontmatter included in mdx
export type Frontmatter = Record<string, unknown>;

// Response from mdxToHtml
export interface MdxToHtmlResponse {
  html: string;
  frontmatter: Frontmatter;
  originalElements: OriginalElements;
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

// Convert mdx to html, frontmatter, and original elements
export function mdxToHtml(
  rootContent: string,
  options?: MdxToHtmlOptions
): MdxToHtmlResponse {
  const { treatAsCustomElement = [], treatAsUnsupported = [] } = options ?? {};

  // Get mdast from root mdx content
  const mdast = fromMarkdown(rootContent, {
    extensions: [mdxjs(), fm(["yaml"]), math()],
    mdastExtensions: [
      mdxFromMarkdown(),
      frontmatterFromMarkdown(["yaml"]),
      mathFromMarkdown(),
    ],
  });

  // Get frontmatter from mdast (expects only one frontmatter node)
  const frontmatterNode = mdast.children.find((node) => node.type === "yaml");
  const originalFrontmatter = frontmatterNode?.value;

  // Parse frontmatter from yaml
  const parsedFrontmatter =
    originalFrontmatter && yaml.load(originalFrontmatter);
  const frontmatter = isValidFrontmatter(parsedFrontmatter)
    ? parsedFrontmatter
    : {};

  // Map of original elements by hash, including jsxElements, expressions, and esm
  // Note: this will only include top-level elements, not nested ones
  const originalElements: OriginalElements = {};

  // Default handler for base elements
  function baseElementHandler(
    state: ToHastState,
    node: any,
    parents?: MdastParents
  ) {
    const { type, name } = getNodeInfo(node);
    const nodeType = type as BaseElementsType;
    if (treatAsUnsupported.includes(nodeType)) {
      throw new Error(`Unsupported node type: ${nodeType}`);
    }
    if (!isHashableBaseElementsType(nodeType)) {
      // Early return if the node is not hashable
      return getToHastDefaultHandler(nodeType)(state, node, parents);
    }
    const { hash, content } = getNodeContent(node, rootContent);
    originalElements[hash] = { content, type, name };
    return mdxBaseElementNode(
      hash,
      content,
      nodeType,
      name,
      state,
      node,
      parents
    );
  }

  // Default handler for custom elements
  function customElementHandler(_: ToHastState, node: any, __?: MdastParents) {
    const { type, name } = getNodeInfo(node);
    const nodeType = type as CustomElementsType;
    if (treatAsUnsupported.includes(nodeType)) {
      throw new Error(`Unsupported node type: ${nodeType}`);
    }
    const { hash, content } = getNodeContent(node, rootContent);
    originalElements[hash] = { content, type, name };
    return mdxCustomElementNode(hash, content, nodeType, name);
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
        html: baseElementHandler,
        image: baseElementHandler,
        imageReference: baseElementHandler,
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
        yaml: baseElementHandler,
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
        ...Object.fromEntries(
          treatAsCustomElement.map((type) => [type, customElementHandler])
        ),
      } as Record<CustomElementsType, ToHastHandler>),
    },
  });

  // Get html from hast
  const html = toHtml(hast);

  return { html, frontmatter, originalFrontmatter, originalElements };
}

// Response from htmlToMdx
export interface HtmlToMdxResponse {
  mdx: string;
}

// Convert html to mdx
// TODO: we might be able to further optimize by refactoring this and getChangedNodesFromHtml
export function htmlToMdx(
  html: string,
  frontmatter: Frontmatter,
  originalElements: OriginalElements,
  originalFrontmatter?: string,
  changedNodes?: ChangedNodes,
  changedFrontmatter?: boolean
): HtmlToMdxResponse {
  // Get hast from html
  const hast = fromHtml(html);

  // Default handler for base elements
  const baseElementHandler: ToMdastHandle = (state, element) => {
    if (
      element.properties?.dataHash &&
      typeof element.properties.dataHash === "string" &&
      typeof originalElements[element.properties.dataHash] !== "undefined" &&
      changedNodes?.[element.properties.dataHash] === false
    ) {
      // Use hash as placeholder, which will be replaced with actual content
      const placeholder = getCustomElementPlaceholder(
        String(element.properties.dataHash)
      );

      return { type: "html", value: placeholder } as any;
    }
    return getToMdastDefaultHandler(element.tagName as any)(state, element);
  };

  // Default handler for custom elements
  const customElementHandler: ToMdastHandle = (_, element) => {
    // Use hash as placeholder, which will be replaced with actual content
    const placeholder = getCustomElementPlaceholder(
      String(element.properties.dataHash)
    );

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
      ["custom-element"]: customElementHandler,
    } as any,
    newlines: true,
  });

  // Get mdx from mdast
  const mdx = toMarkdown(mdast, {
    extensions: [
      mdxToMarkdown(),
      frontmatterToMarkdown(["yaml"]),
      mathToMarkdown({ singleDollarTextMath: false }),
    ],
    // TODO: float configurations up to make them more discoverable
    // Use hyphen instead of asterisk for unordered lists
    bullet: "-",
  });

  // Reinject frontmatter if it exists
  let finalMdx = mdx;
  if (changedFrontmatter === false && originalFrontmatter) {
    finalMdx = `---\n${originalFrontmatter}---\n\n${mdx}`;
  } else if (frontmatter && Object.keys(frontmatter).length > 0) {
    const frontmatterYaml = yaml.dump(frontmatter, FRONTMATTER_YAML_OPTIONS);
    finalMdx = `---\n${frontmatterYaml}---\n\n${mdx}`;
  }

  // Replace custom element placeholders with actual content
  Object.entries(originalElements).forEach(([hash, customElement]) => {
    const placeholder = getCustomElementPlaceholder(hash);
    const content = customElement.content;

    // Escape dollar signs in content to prevent them from being treated as replacement references
    // In JavaScript string replacement, $ has special meaning:
    // - $& inserts the matched substring
    // - $` inserts the portion of the string that precedes the matched substring
    // - $' inserts the portion of the string that follows the matched substring
    // - $n inserts the nth parenthesized submatch string
    // By doubling the $ ($$), we insert a literal $ character
    const escapedContent = content.replace(/\$/g, "$$$$");

    // Replace placeholder with escaped content, using replaceAll for cases where there are repeats
    finalMdx = finalMdx.replaceAll(placeholder, escapedContent);
  });

  return { mdx: finalMdx };
}

// Type guard to check if frontmatter is valid
function isValidFrontmatter(
  frontmatter: unknown
): frontmatter is Record<string, unknown> {
  const isValid =
    !!frontmatter &&
    typeof frontmatter === "object" &&
    !Array.isArray(frontmatter);
  if (!isValid) {
    console.warn("Invalid or missing frontmatter", frontmatter);
  }
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
  return {
    type: node.type as string,
    name: node.name as string | undefined,
  };
}

// Get node content in a type-safe way
// TODO: consider writing type guards for the node, since toHast does not type it by default
function getNodeContent(node: any, rootContent: string) {
  if (
    node.position?.start.offset == null ||
    node.position?.end.offset == null
  ) {
    throw new Error("Node does not have valid position offset(s)");
  }
  const content = rootContent.slice(
    node.position.start.offset,
    node.position.end.offset
  );
  const hash: NodeHash = createHash("sha256").update(content).digest("hex");

  return { content, hash };
}

// TODO: we might be able to further optimize by refactoring this and htmlToMdx
export function getChangedNodesFromHtml(
  originalHtml: string,
  latestHtml: string
): ChangedNodes {
  const originalHast = fromHtml(originalHtml);
  const latestHast = fromHtml(latestHtml);

  const originalMap = getNodeMapFromHast(originalHast);
  const latestMap = getNodeMapFromHast(latestHast);

  // Default to all nodes being changed until we can compare them
  const changedNodes: ChangedNodes = {
    ...Object.fromEntries(Object.keys(originalMap).map((hash) => [hash, true])),
    ...Object.fromEntries(Object.keys(latestMap).map((hash) => [hash, true])),
  };

  // Compare nodes with the same hash
  for (const hash of Object.keys(originalMap)) {
    if (hash in latestMap) {
      // Compare the node contents
      const originalNode = originalMap[hash];
      const latestNode = latestMap[hash];
      const { content: originalContent } = getNodeContent(
        originalNode,
        originalHtml
      );
      const { content: latestContent } = getNodeContent(latestNode, latestHtml);
      changedNodes[hash] = originalContent !== latestContent;
    }
  }
  return changedNodes;
}

// Helper to get first-level elements with data-hash (dataHash) under root -> html -> body
// TODO: consider writing type guards for the hast nodes, since toHast does not type it by default
function getNodeMapFromHast(hast: HastRoot) {
  const map: Record<NodeHash, any> = {};
  let bodyChildren: any[] | undefined;
  if (hast && Array.isArray(hast.children)) {
    // Find the <html> element
    const htmlNode = hast.children.find(
      (node) => node.type === "element" && node.tagName === "html"
    );
    if (
      htmlNode &&
      htmlNode.type === "element" &&
      Array.isArray(htmlNode.children)
    ) {
      // Find the <body> element inside <html>
      const bodyNode = htmlNode.children.find(
        (node) => node.type === "element" && node.tagName === "body"
      );
      if (
        bodyNode &&
        bodyNode.type === "element" &&
        Array.isArray(bodyNode.children)
      ) {
        bodyChildren = bodyNode.children;
      }
    }
  }
  if (bodyChildren) {
    for (const node of bodyChildren) {
      if (
        node &&
        node.type === "element" &&
        node.properties &&
        typeof node.properties.dataHash === "string"
      ) {
        map[node.properties.dataHash] = node;
      }
    }
  }
  return map;
}

// Get a placeholder for a custom element
// Note: be careful not to use any characters that the serializer will escape
function getCustomElementPlaceholder(hash: NodeHash) {
  return `PLACEHOLDER${hash}`;
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
  hash: NodeHash,
  _: string,
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
        // Note: we add a data-hash property to the element for the client's reference
        return {
          ...defaultNode,
          properties: {
            ...defaultNode.properties,
            "data-hash": hash,
          },
        };
      } else if (
        defaultNode.type === "comment" ||
        defaultNode.type === "text" ||
        defaultNode.type === "raw"
      ) {
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

// Create node for a custom element
function mdxCustomElementNode(
  hash: NodeHash,
  content: string,
  type: CustomElementsType,
  name: string | undefined
) {
  return {
    type: "element" as const,
    tagName: "custom-element",
    // These data attributes help the client to handle the custom element
    properties: {
      "data-hash": hash,
      "data-type": type,
      ...(name ? { "data-name": name } : {}),
    },
    children: [
      {
        type: "text" as const,
        value: content,
      },
    ],
  };
}

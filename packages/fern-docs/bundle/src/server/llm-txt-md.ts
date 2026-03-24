import { ApiDefinition, type FernNavigation } from "@fern-api/fdr-sdk";
import type { ObjectProperty, TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { renderTypeShorthand } from "@fern-docs/components/type-shorthand";
import { getFrontmatter, isMdxJsxElementHast, mdastToMarkdown, toTree, visit } from "@fern-docs/mdx";
import { isString } from "es-toolkit/predicate";

/**
 * Callback to resolve types for a given API name.
 * Returns a record of TypeId -> TypeDefinition for the matching API.
 */
export type TypesResolver = (apiName?: string) => Promise<Record<FernNavigation.TypeId, TypeDefinition> | undefined>;

export function convertToLlmTxtMarkdown(
    markdown: string,
    nodeTitle: string,
    format: "mdx" | "md",
    userRoles: string[] = []
): string {
    const { title, description, content } = getLlmTxtMetadata(markdown, nodeTitle);
    // TODO: add link-backs to the source of the content
    // TODO: parse the markdown content and delete any unnecessary content

    return [
        `# ${title}`,
        description != null ? `> ${description}` : undefined,
        stripMdxFeatures(content, format, userRoles, "llm")
    ]
        .filter(isNonNullish)
        .join("\n\n");
}

/**
 * Filters markdown content for the Copy Page feature.
 * Unlike LLM text, this:
 * - Removes <llms-only> tags entirely (content is for LLMs only, not humans)
 * - Unwraps <llms-ignore> tags (content is for humans, hidden from LLMs)
 * - Applies RBAC filtering based on user roles
 * - Does NOT add title/description formatting
 */
export function filterMarkdownForCopyPage(markdown: string, format: "mdx" | "md", userRoles: string[] = []): string {
    return stripMdxFeatures(markdown, format, userRoles, "copy-page");
}

/**
 * Filters markdown content for LLM-serving endpoints (llms.txt, llms-full.txt, .md/.mdx).
 * Unlike Copy Page, this:
 * - Unwraps <llms-only> tags (content is for LLMs, always shown)
 * - Removes <llms-ignore> tags entirely (content is for humans only, hidden from LLMs)
 * - Applies RBAC filtering based on user roles
 * - Does NOT add title/description formatting
 */
export function filterMarkdownForLlm(markdown: string, format: "mdx" | "md", userRoles: string[] = []): string {
    return stripMdxFeatures(markdown, format, userRoles, "llm");
}

/**
 * Strips MDX features from markdown content.
 *
 * For LLM mode:
 * - <llms-ignore> tags are removed entirely (never shown to LLMs)
 * - <llms-only> tags are unwrapped (content always shown to LLMs)
 *
 * For Copy Page mode:
 * - <llms-ignore> tags are unwrapped (content is for humans, hidden from LLMs)
 * - <llms-only> tags are removed entirely (content is for LLMs only, not humans)
 *
 * Both modes:
 * - esm imports are removed
 * - <style> and <script> tags are removed
 * - img tags with data: urls are removed
 * - <If> tags are filtered based on user roles (RBAC)
 */
function stripMdxFeatures(
    markdown: string,
    format: "mdx" | "md",
    userRoles: string[] = [],
    mode: "llm" | "copy-page" = "llm"
): string {
    if (format !== "mdx") {
        return markdown;
    }

    const { mdast } = toTree(markdown, {
        format,
        sanitize: true
    });

    visit(mdast, (node, idx, parent) => {
        if (parent == null || idx == null) {
            return;
        }

        if (isMdxJsxElementHast(node)) {
            // Handle <llms-ignore> tags differently based on mode
            if (node.name === "llms-ignore") {
                if (mode === "llm") {
                    // LLM mode: remove entirely (never show to LLMs)
                    parent.children.splice(idx, 1);
                } else {
                    // Copy Page mode: unwrap (content is for humans)
                    parent.children.splice(idx, 1, ...node.children);
                }
                return idx;
            }

            // Handle <llms-only> tags differently based on mode
            if (node.name === "llms-only") {
                if (mode === "llm") {
                    // LLM mode: unwrap (content always shown to LLMs)
                    parent.children.splice(idx, 1, ...node.children);
                } else {
                    // Copy Page mode: remove entirely (content is for LLMs only)
                    parent.children.splice(idx, 1);
                }
                return idx;
            }

            // remove <If> tags when user doesn't have required roles
            // Note: supports both "roles" and "viewer" attributes for backwards compatibility
            if (node.name === "If") {
                const rolesAttr =
                    node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "roles") ??
                    node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "viewer");

                let requiredRoles: string[] = [];

                if (rolesAttr && rolesAttr.value != null) {
                    // Handle array format: roles={["admin", "editor"]} or viewer={["everyone"]}
                    if (typeof rolesAttr.value === "object" && "value" in rolesAttr.value) {
                        const expressionValue = (rolesAttr.value as { value: unknown }).value;
                        if (typeof expressionValue === "string") {
                            try {
                                const parsed = JSON.parse(expressionValue);
                                if (Array.isArray(parsed)) {
                                    requiredRoles = parsed.filter((r: unknown) => typeof r === "string");
                                }
                            } catch {
                                // If parsing fails, log and continue with empty roles (will show content)
                                logger.error(`[llm-txt-md] Failed to parse roles attribute: ${expressionValue}`);
                            }
                        }
                    }
                }

                const hasEveryoneRole = requiredRoles.includes("everyone");
                const hasRequiredRole = userRoles.some((role) => requiredRoles.includes(role));
                // If no roles specified or parsing failed, default to showing content
                const noRolesSpecified = requiredRoles.length === 0;

                const shouldShowContent = hasEveryoneRole || hasRequiredRole || noRolesSpecified;

                if (!shouldShowContent) {
                    parent.children.splice(idx, 1);
                    return idx;
                } else {
                    parent.children.splice(idx, 1, ...node.children);
                    return idx;
                }
            }

            // remove <style> and <script> tags
            if (node.name === "style" || node.name === "script") {
                parent.children.splice(idx, 1);
                return idx;
            }

            // remove imgs and related tags that reference data: urls
            const src = node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "src")?.value;
            if (typeof src === "string" && src.startsWith("data:")) {
                parent.children.splice(idx, 1);
                return idx;
            }

            node.attributes = node.attributes.filter((attr) =>
                attr.type === "mdxJsxAttribute" ? attr.name !== "className" && attr.name !== "style" : true
            );

            if (node.name === "div" || node.name === "span" || node.name === "p" || node.name === "section") {
                if (node.children.length === 0) {
                    parent.children.splice(idx, 1);
                    return idx;
                }
            }
        }

        if (node.type === "mdxjsEsm") {
            if (node.data?.estree != null) {
                if (node.data.estree.body[0]?.type !== "ExportNamedDeclaration") {
                    parent.children.splice(idx, 1);
                    return idx;
                }
            }
        }

        return;
    });

    return mdastToMarkdown(mdast);
}

interface LlmTxtMetadata {
    title: string;
    description: string | undefined;
    content: string;
}

/**
 * Schema component names that use a `type` prop to reference a type definition.
 * Includes both the primary components (Schema, SchemaSnippet) and related components
 * (RequestSchema, ResponseSchema, EndpointSchemaSnippet) that may appear in customer MDX.
 */
const SCHEMA_COMPONENT_NAMES = new Set([
    "Schema",
    "SchemaSnippet",
    "RequestSchema",
    "ResponseSchema",
    "EndpointSchemaSnippet"
]);

interface SchemaComponentInfo {
    typeName: string;
    apiName: string | undefined;
    include: string[] | undefined;
    exclude: string[] | undefined;
    excludeDeprecated: boolean;
}

/**
 * Extracts schema component attributes from a JSX element node.
 */
function extractSchemaAttrs(node: Parameters<Parameters<typeof visit>[1]>[0]): SchemaComponentInfo | undefined {
    if (!isMdxJsxElementHast(node) || !SCHEMA_COMPONENT_NAMES.has(node.name ?? "")) {
        return undefined;
    }

    const getStringAttr = (name: string): string | undefined => {
        const attr = node.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === name);
        return typeof attr?.value === "string" ? attr.value.trim() : undefined;
    };

    const getArrayAttr = (name: string): string[] | undefined => {
        const attr = node.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === name);
        if (attr?.value != null && typeof attr.value === "object" && "value" in attr.value) {
            const expressionValue = (attr.value as { value: unknown }).value;
            if (typeof expressionValue === "string") {
                try {
                    const parsed = JSON.parse(expressionValue);
                    if (Array.isArray(parsed)) {
                        return parsed.filter((r: unknown) => typeof r === "string");
                    }
                } catch {
                    // fall through
                }
            }
        }
        return undefined;
    };

    const getBooleanAttr = (name: string): boolean => {
        const attr = node.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === name);
        if (attr == null) {
            return false;
        }
        // Self-closing boolean attribute: <Schema excludeDeprecated />
        if (attr.value == null) {
            return true;
        }
        return attr.value === "true";
    };

    const typeName = getStringAttr("type");
    if (typeName == null) {
        return undefined;
    }

    return {
        typeName,
        apiName: getStringAttr("api"),
        include: getArrayAttr("include"),
        exclude: getArrayAttr("exclude"),
        excludeDeprecated: getBooleanAttr("excludeDeprecated")
    };
}

/**
 * Builds a unique cache key for a schema component based on its attributes.
 */
function buildSchemaKey(info: SchemaComponentInfo): string {
    const parts = [info.apiName ?? "__default__", info.typeName];
    if (info.include != null) {
        parts.push(`include:${info.include.join(",")}`);
    }
    if (info.exclude != null) {
        parts.push(`exclude:${info.exclude.join(",")}`);
    }
    if (info.excludeDeprecated) {
        parts.push("excludeDeprecated");
    }
    return parts.join("::");
}

/**
 * Resolves <Schema> and <SchemaSnippet> components in the markdown content by looking up
 * type definitions and converting them to inline markdown representations suitable for LLMs.
 * Unresolvable components are removed from the output.
 */
export async function resolveSchemaComponents(
    markdown: string,
    format: "mdx" | "md",
    typesResolver: TypesResolver
): Promise<string> {
    // Quick check: if the markdown doesn't contain any schema component references, skip parsing
    const hasSchemaComponent = [...SCHEMA_COMPONENT_NAMES].some((name) => markdown.includes(`<${name}`));
    if (!hasSchemaComponent) {
        return markdown;
    }

    // Always parse as mdx so that <Schema> JSX elements are recognized,
    // even when the source page is .md format
    const { mdast } = toTree(markdown, {
        format: "mdx",
        sanitize: true
    });

    // Single pass: collect schema component info for async resolution,
    // and track whether any schema components exist at all (including those without type attr)
    const schemaComponentInfos: SchemaComponentInfo[] = [];
    let hasAnySchemaNode = false;

    visit(mdast, (node, idx, parent) => {
        if (parent == null || idx == null) {
            return;
        }
        if (isMdxJsxElementHast(node) && SCHEMA_COMPONENT_NAMES.has(node.name ?? "")) {
            hasAnySchemaNode = true;
            const info = extractSchemaAttrs(node);
            if (info != null) {
                schemaComponentInfos.push(info);
            }
        }
    });

    if (!hasAnySchemaNode) {
        return markdown;
    }

    // Resolve types for all unique API names in parallel
    const uniqueApiNames = new Set(schemaComponentInfos.map((info) => info.apiName));
    const resolvedTypesMap = new Map<string, Record<FernNavigation.TypeId, TypeDefinition>>();

    await Promise.all(
        [...uniqueApiNames].map(async (apiName) => {
            try {
                const types = await typesResolver(apiName);
                if (types != null) {
                    resolvedTypesMap.set(apiName ?? "__default__", types);
                }
            } catch (e) {
                logger.error(`Failed to resolve types for API "${apiName ?? "default"}"`, e);
            }
        })
    );

    // Build a map of key -> resolved markdown for quick lookup
    const schemaReplacements = new Map<string, string>();

    for (const info of schemaComponentInfos) {
        const key = buildSchemaKey(info);
        if (schemaReplacements.has(key)) {
            continue;
        }

        const types = resolvedTypesMap.get(info.apiName ?? "__default__");
        if (types == null) {
            continue;
        }

        // Find the matching type definition by name
        let matchedTypeDef: TypeDefinition | undefined;
        for (const typeDef of Object.values(types)) {
            if (typeDef.name === info.typeName) {
                matchedTypeDef = typeDef;
                break;
            }
        }

        if (matchedTypeDef != null) {
            const schemaMarkdown = typeDefinitionToMarkdown(matchedTypeDef, types, {
                include: info.include,
                exclude: info.exclude,
                excludeDeprecated: info.excludeDeprecated
            });
            if (schemaMarkdown != null) {
                schemaReplacements.set(key, schemaMarkdown);
            }
        } else {
            logger.warn(
                `Schema component references unknown type "${info.typeName}"${info.apiName ? ` in API "${info.apiName}"` : ""}`
            );
        }
    }

    // Replace or remove schema components in the AST using the pre-resolved types
    visit(mdast, (node, idx, parent) => {
        if (parent == null || idx == null) {
            return undefined;
        }

        const info = extractSchemaAttrs(node);
        if (info != null) {
            const key = buildSchemaKey(info);
            const replacement = schemaReplacements.get(key);
            if (replacement != null) {
                parent.children.splice(idx, 1, ...toTree(replacement, { format: "md", sanitize: true }).mdast.children);
            } else {
                // Replace unresolvable schema components with a plain-text reference
                // so LLMs know a type was referenced, rather than leaving raw JSX
                const fallback = `See type: ${info.typeName}`;
                parent.children.splice(idx, 1, ...toTree(fallback, { format: "md", sanitize: true }).mdast.children);
            }
            return idx;
        }

        // Remove schema-like components that have no type attr (malformed)
        if (isMdxJsxElementHast(node) && SCHEMA_COMPONENT_NAMES.has(node.name ?? "")) {
            parent.children.splice(idx, 1);
            return idx;
        }

        return undefined;
    });

    return mdastToMarkdown(mdast);
}

interface PropertyFilterOptions {
    include?: string[];
    exclude?: string[];
    excludeDeprecated?: boolean;
}

/**
 * Filters object properties based on include/exclude lists and deprecated status,
 * matching the behavior of the Schema React component.
 */
function filterProperties(properties: ObjectProperty[], options?: PropertyFilterOptions): ObjectProperty[] {
    if (options == null) {
        return properties;
    }
    return properties.filter((prop) => {
        if (options.include != null && options.include.length > 0 && !options.include.includes(String(prop.key))) {
            return false;
        }
        if (options.exclude?.includes(String(prop.key))) {
            return false;
        }
        if (options.excludeDeprecated && prop.availability === "Deprecated") {
            return false;
        }
        return true;
    });
}

const MAX_NESTED_DEPTH = 3;

/**
 * Renders a single property line for markdown output.
 * When a property references a nested object type, its sub-properties are
 * rendered as indented lines (up to MAX_NESTED_DEPTH levels deep).
 */
function renderPropertyLine(
    prop: ObjectProperty,
    types: Record<FernNavigation.TypeId, TypeDefinition>,
    depth: number = 0
): string {
    const indent = "  ".repeat(depth);
    const ref = ApiDefinition.unwrapReference(prop.valueShape, types);
    const typeName = renderTypeShorthand(prop.valueShape, { hideAllModifiers: true }, types);
    const optional = ref?.isOptional ? " (optional)" : " (required)";
    const desc = getPropertyDescription(prop.description, ref?.descriptions);
    const inline = getInlineTypeDetail(ref?.shape, types, 0);
    let line = `${indent}- \`${prop.key}\` ${typeName}${optional}${desc}${inline}`;

    // Recursively render sub-properties for nested object types (including lists/sets of objects)
    if (depth < MAX_NESTED_DEPTH && ref?.shape != null) {
        let nestedObjectShape: ApiDefinition.DereferencedNonOptionalTypeShapeOrReference | undefined;
        if (ref.shape.type === "object") {
            nestedObjectShape = ref.shape;
        } else if (ref.shape.type === "list" || ref.shape.type === "set") {
            const itemRef = ApiDefinition.unwrapReference(ref.shape.itemShape, types);
            if (itemRef?.shape.type === "object") {
                nestedObjectShape = itemRef.shape;
            }
        }
        if (nestedObjectShape != null && nestedObjectShape.type === "object") {
            const nested = ApiDefinition.unwrapObjectType(nestedObjectShape, types);
            if (nested.properties.length > 0) {
                const subLines = nested.properties.map((sub) => renderPropertyLine(sub, types, depth + 1));
                line += "\n" + subLines.join("\n");
            }
        }
    }

    return line;
}

/**
 * Converts a TypeDefinition into a markdown representation for LLMs.
 * This produces a structured description of the type's properties, enum values,
 * union variants, etc.
 */
function typeDefinitionToMarkdown(
    typeDef: TypeDefinition,
    types: Record<FernNavigation.TypeId, TypeDefinition>,
    filterOptions?: PropertyFilterOptions
): string | undefined {
    const sections: string[] = [];

    // Add the type name as a heading
    sections.push(`### ${typeDef.name}`);

    // Add description if available
    if (typeof typeDef.description === "string" && typeDef.description.length > 0) {
        sections.push(typeDef.description);
    }

    const shape = typeDef.shape;

    switch (shape.type) {
        case "object": {
            const unwrapped = ApiDefinition.unwrapObjectType(shape, types);
            const filtered = filterProperties(unwrapped.properties, filterOptions);
            if (filtered.length > 0) {
                sections.push("**Properties:**");
                sections.push(filtered.map((prop) => renderPropertyLine(prop, types)).join("\n"));
            }
            break;
        }
        case "enum": {
            sections.push("**Enum values:**");
            sections.push(
                shape.values
                    .map((v) => {
                        const desc =
                            typeof v.description === "string" && v.description.length > 0 ? `: ${v.description}` : "";
                        return `- \`${v.value}\`${desc}`;
                    })
                    .join("\n")
            );
            break;
        }
        case "undiscriminatedUnion": {
            sections.push("**One of:**");
            sections.push(
                shape.variants
                    .map((variant) => {
                        const typeName = renderTypeShorthand(variant.shape, { hideAllModifiers: true }, types);
                        const desc =
                            typeof variant.description === "string" && variant.description.length > 0
                                ? `: ${variant.description}`
                                : "";
                        return `- ${typeName}${desc}`;
                    })
                    .join("\n")
            );
            break;
        }
        case "discriminatedUnion": {
            sections.push(`**Discriminated union** (discriminant: \`${shape.discriminant}\`)`);
            sections.push(
                shape.variants
                    .map((variant) => {
                        const unwrapped = ApiDefinition.unwrapDiscriminatedUnionVariant(shape, variant, types);
                        const variantDesc =
                            typeof variant.description === "string" && variant.description.length > 0
                                ? `: ${variant.description}`
                                : "";
                        const props = unwrapped.properties.map((prop) => renderPropertyLine(prop, types, 1)).join("\n");
                        return `- \`${variant.discriminantValue}\`${variantDesc}\n${props}`;
                    })
                    .join("\n")
            );
            break;
        }
        case "alias": {
            const typeName = renderTypeShorthand(shape.value, { hideAllModifiers: true }, types);
            sections.push(`**Type:** ${typeName}`);
            break;
        }
    }

    return sections.join("\n\n");
}

/**
 * Returns an inline detail string for an already-unwrapped type shape.
 * Follows the hasInlineEnum pattern from the API reference to show enum values
 * and union variants inline when there are few enough values.
 */
function getInlineTypeDetail(
    shape: ApiDefinition.DereferencedNonOptionalTypeShapeOrReference | undefined,
    types: Record<FernNavigation.TypeId, TypeDefinition>,
    depth: number = 0
): string {
    if (shape == null || depth > MAX_NESTED_DEPTH) {
        return "";
    }

    if (shape.type === "enum" && shape.values.length > 0) {
        const vals = shape.values.map((v) => `\`${v.value}\``).join(", ");
        return ` — one of: ${vals}`;
    }
    if (shape.type === "undiscriminatedUnion" && shape.variants.length > 0) {
        const variants = shape.variants
            .map((v) => renderTypeShorthand(v.shape, { hideAllModifiers: true }, types))
            .join(", ");
        return ` — one of: ${variants}`;
    }
    if (shape.type === "list") {
        const unwrappedItem = ApiDefinition.unwrapReference(shape.itemShape, types);
        return getInlineTypeDetail(unwrappedItem?.shape, types, depth + 1);
    }
    if (shape.type === "set") {
        const unwrappedItem = ApiDefinition.unwrapReference(shape.itemShape, types);
        return getInlineTypeDetail(unwrappedItem?.shape, types, depth + 1);
    }

    return "";
}

function getPropertyDescription(propDescription: unknown, refDescriptions: unknown[] | undefined): string {
    const descriptions = [propDescription, ...(refDescriptions ?? [])].filter(isString);
    const desc = descriptions[0];
    if (desc != null && desc.length > 0) {
        return `: ${desc}`;
    }
    return "";
}

export function getLlmTxtMetadata(markdown: string, nodeTitle: string): LlmTxtMetadata {
    const { data: frontmatter, content } = getFrontmatter(markdown);
    return {
        // TODO: parse the first h1 as the title
        title: frontmatter.title ?? nodeTitle,
        /**
         * Note: the description field in the frontmatter is expected to be the most descriptive
         * which is useful for LLM context. However, it's not always available, so we fall back
         * to other fields. But, effectively only one is selected to avoid redundancy.
         */
        description:
            frontmatter.description ??
            frontmatter["og:description"] ??
            frontmatter.subtitle ??
            frontmatter.headline ??
            frontmatter.excerpt,
        content
    };
}

#!/usr/bin/env tsx
/**
 * generate-ai-components-md.ts
 *
 * Reads all *.stories.tsx files under src/components/ and writes a
 * COMPONENTS.md file at the repo root for use by AI coding assistants.
 *
 * Run:  pnpm generate-ai-components-md
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DASHBOARD_ROOT = path.resolve(__dirname, "..");
const COMPONENTS_SRC = path.join(DASHBOARD_ROOT, "src", "components");
const REPO_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_PATH = path.join(REPO_ROOT, "COMPONENTS.md");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PropInfo {
    name: string;
    type?: string; // "boolean" | "select" | "inline-radio" | "text" | etc.
    options?: string[];
}

interface ComponentDoc {
    name: string;
    title: string;
    importPath: string;
    /** Repo-relative path to the component source file */
    componentFile: string;
    /** Repo-relative path to the stories file */
    storyFile: string;
    description: string;
    props: PropInfo[];
    /** Additional named exports (sub-components for compound components) */
    namedExports: string[];
    /** JSX usage example generated from the Default story args */
    usageExample: string;
    stories: string[];
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function findStoryFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findStoryFiles(full));
        } else if (entry.isFile() && entry.name.endsWith(".stories.tsx")) {
            results.push(full);
        }
    }
    return results;
}

// ---------------------------------------------------------------------------
// Block extraction (depth-aware, handles nested braces)
// ---------------------------------------------------------------------------

/**
 * Extracts the inner content of `keyword: { ... }` with proper brace-depth
 * tracking so nested objects don't prematurely terminate the match.
 */
function extractBlock(content: string, keyword: string): string {
    const re = new RegExp(`\\b${keyword}\\s*:\\s*\\{`);
    const match = re.exec(content);
    if (!match) {
        return "";
    }

    // The opening `{` is the last character of the match
    const openBrace = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = openBrace; i < content.length; i++) {
        if (content[i] === "{") {
            depth++;
        } else if (content[i] === "}") {
            depth--;
            if (depth === 0) {
                return content.slice(openBrace + 1, i);
            }
        }
    }
    return "";
}

// ---------------------------------------------------------------------------
// ArgTypes parsing
// ---------------------------------------------------------------------------

/**
 * Parses argTypes block into a list of PropInfo.
 * Handles nested objects properly via brace-depth tracking.
 */
function parseArgTypes(content: string): PropInfo[] {
    const block = extractBlock(content, "argTypes");
    if (!block) {
        return [];
    }

    const props: PropInfo[] = [];
    let i = 0;
    let depth = 0;

    while (i < block.length) {
        const ch = block[i]!;
        if (ch === "{" || ch === "[" || ch === "(") {
            depth++;
            i++;
            continue;
        }
        if (ch === "}" || ch === "]" || ch === ")") {
            depth--;
            i++;
            continue;
        }

        if (depth === 0) {
            // Match a top-level identifier followed by `:`
            const keyMatch = /^(\w+)\s*:/.exec(block.slice(i));
            if (keyMatch) {
                const propName = keyMatch[1]!;
                i += keyMatch[0].length;

                // Skip whitespace
                while (i < block.length && /\s/.test(block[i]!)) {
                    i++;
                }

                // Extract this prop's value block `{ ... }`
                let propBlock = "";
                if (block[i] === "{") {
                    const start = i;
                    let d = 0;
                    for (; i < block.length; i++) {
                        if (block[i] === "{") {
                            d++;
                        } else if (block[i] === "}") {
                            d--;
                            if (d === 0) {
                                propBlock = block.slice(start + 1, i);
                                i++;
                                break;
                            }
                        }
                    }
                }

                // Extract control.type (e.g. "select", "boolean", "inline-radio")
                const ctrlType = propBlock.match(/control\s*:\s*\{\s*type\s*:\s*["']([^"']+)["']/)?.[1];

                // Extract options array (ignore `satisfies ...` suffix)
                const optMatch = propBlock.match(/options\s*:\s*\[([\s\S]*?)\]/);
                const options: string[] = [];
                if (optMatch) {
                    for (const m of optMatch[1]!.matchAll(/["']([^"']+)["']/g)) {
                        options.push(m[1]!);
                    }
                }

                props.push({
                    name: propName,
                    ...(ctrlType ? { type: ctrlType } : {}),
                    ...(options.length > 0 ? { options } : {})
                });
                continue;
            }
        }
        i++;
    }

    return props;
}

// ---------------------------------------------------------------------------
// Named export extraction (for compound components)
// ---------------------------------------------------------------------------

/**
 * Reads the component source file and returns all PascalCase named exports,
 * excluding the primary component name itself.
 */
function extractNamedExports(filePath: string, primaryName: string): string[] {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    const content = fs.readFileSync(filePath, "utf-8");

    const names = new Set<string>();

    // export { A, B, C };
    for (const m of content.matchAll(/^export\s*\{([^}]+)\}/gm)) {
        for (const part of m[1]!.split(",")) {
            const name = part
                .trim()
                .split(/\s+as\s+/)
                .pop()!
                .trim();
            if (/^[A-Z]/.test(name)) {
                names.add(name);
            }
        }
    }

    // export function Foo / export const Foo / export class Foo
    for (const m of content.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Z]\w*)/gm)) {
        names.add(m[1]!);
    }

    // Remove type-only exports
    for (const m of content.matchAll(/^export\s+type\s*\{([^}]+)\}/gm)) {
        for (const part of m[1]!.split(",")) {
            names.delete(
                part
                    .trim()
                    .split(/\s+as\s+/)
                    .pop()!
                    .trim()
            );
        }
    }

    // Remove the primary component itself — it's already in the import line
    names.delete(primaryName);

    return [...names].sort();
}

// ---------------------------------------------------------------------------
// Usage example
// ---------------------------------------------------------------------------

/**
 * Generates a minimal JSX snippet from the Default story's `args` object.
 * Only works for simple args (string/boolean values). Returns empty string
 * if the Default story uses a custom render function or has complex args.
 */
function extractUsageExample(content: string, componentName: string): string {
    // Find Default story block — stop before the next `export const`
    const defaultMatch = content.match(
        /export const Default\s*:\s*Story[^=]*=\s*\{([\s\S]*?)(?=\nexport const |\nexport default |$)/
    );
    if (!defaultMatch) {
        return "";
    }

    const storyBlock = defaultMatch[1]!;

    // Skip if it has a custom render function
    if (/\brender\s*:/.test(storyBlock)) {
        return "";
    }

    // Extract the args block
    const argsBlock = extractBlock(storyBlock, "args");
    if (!argsBlock) {
        return `<${componentName} />`;
    }

    const props: string[] = [];
    let children = "";

    // String props
    for (const m of argsBlock.matchAll(/(\w+)\s*:\s*["']([^"']+)["']/g)) {
        if (m[1] === "children") {
            children = m[2]!;
        } else {
            props.push(`${m[1]}="${m[2]}"`);
        }
    }
    // Boolean props (only include `true` ones as shorthand)
    for (const m of argsBlock.matchAll(/(\w+)\s*:\s*(true|false)\b/g)) {
        if (m[2] === "true") {
            props.push(m[1]!);
        }
    }

    const propsStr = props.length > 0 ? ` ${props.join(" ")}` : "";
    return children ? `<${componentName}${propsStr}>${children}</${componentName}>` : `<${componentName}${propsStr} />`;
}

// ---------------------------------------------------------------------------
// Parser helpers
// ---------------------------------------------------------------------------

function firstCapture(content: string, re: RegExp): string | null {
    return content.match(re)?.[1]?.trim() ?? null;
}

/**
 * Resolve a relative story import to an @/ alias path.
 */
function resolveImportAlias(storyFile: string, relImport: string): string {
    const srcDir = path.join(DASHBOARD_ROOT, "src");
    const abs = path.resolve(path.dirname(storyFile), relImport);
    return `@/${path.relative(srcDir, abs)}`;
}

/**
 * Resolve a relative import to the actual file on disk.
 * Returns a repo-relative path.
 */
function resolveComponentFile(storyFile: string, relImport: string): string {
    const abs = path.resolve(path.dirname(storyFile), relImport);
    const candidates = [`${abs}.tsx`, `${abs}.ts`, `${abs}/index.tsx`, `${abs}/index.ts`];
    const found = candidates.find((c) => fs.existsSync(c)) ?? `${abs}.tsx`;
    return path.relative(REPO_ROOT, found);
}

/**
 * Look for a same-directory source file matching the component name.
 * Used as a last resort when the story uses a local wrapper component.
 */
function findSourceFileByName(storyFile: string, name: string): string {
    const dir = path.dirname(storyFile);
    const candidates = [
        path.join(dir, `${name}.tsx`),
        path.join(dir, `${name}.ts`),
        path.join(dir, `${name}/index.tsx`)
    ];
    const found = candidates.find((c) => fs.existsSync(c));
    return found ? path.relative(REPO_ROOT, found) : "";
}

/**
 * Extract a component description from the file.
 * Handles single-line strings and string concatenation.
 */
function extractDescription(content: string): string {
    const blockMatch = content.match(/description\s*:\s*\{([\s\S]*?)component\s*:([\s\S]*?)\}/);
    if (!blockMatch) {
        return "";
    }

    const valueSection = blockMatch[2] ?? "";
    const segments: string[] = [];
    // Only match single/double-quoted strings — backticks inside strings are markdown, not JS delimiters
    for (const m of valueSection.matchAll(/["']([\s\S]*?)["']/g)) {
        const seg = (m[1] ?? "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
        if (seg) {
            segments.push(seg);
        }
        if (segments.length >= 10) {
            break;
        }
    }
    return segments.join(" ");
}

// ---------------------------------------------------------------------------
// Story file → ComponentDoc
// ---------------------------------------------------------------------------

function parseStoryFile(filePath: string): ComponentDoc | null {
    const content = fs.readFileSync(filePath, "utf-8");

    const title = firstCapture(content, /title\s*:\s*["']([^"']+)["']/);
    if (!title) {
        return null;
    }

    const name = title.split("/").pop()!;
    const storyFile = path.relative(REPO_ROOT, filePath);

    // The identifier used in `component: X` (may be a local wrapper, not the real component)
    const componentId = firstCapture(content, /component\s*:\s*(\w+)/);

    // Build regexes for named + default imports
    const namedRe = (id: string) => new RegExp(`import\\s*\\{[^}]*\\b${id}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`);
    const defaultRe = (id: string) => new RegExp(`import\\s+${id}\\s+from\\s*["']([^"']+)["']`);

    let importRel: string | null = null;

    // 1. Try the componentId directly (happy path)
    if (componentId) {
        importRel = firstCapture(content, namedRe(componentId)) ?? firstCapture(content, defaultRe(componentId));
    }

    // 2. Fallback: componentId is a local wrapper — try the title-derived component name
    if (!importRel && componentId && componentId !== name) {
        importRel = firstCapture(content, namedRe(name)) ?? firstCapture(content, defaultRe(name));
    }

    let importPath = "";
    let componentFile = "";

    if (importRel) {
        importPath = importRel.startsWith(".") ? resolveImportAlias(filePath, importRel) : importRel;
        if (importRel.startsWith(".")) {
            componentFile = resolveComponentFile(filePath, importRel);
        }
    }

    // 3. Last resort: look for a same-dir file matching the component name
    if (!componentFile) {
        componentFile = findSourceFileByName(filePath, name);
    }

    const description = extractDescription(content);
    const props = parseArgTypes(content);
    const stories = [...content.matchAll(/^export const (\w+)\s*:\s*Story/gm)].map((m) => m[1]!);
    const usageExample = extractUsageExample(content, name);

    // Extract sub-component exports from the source file (for compound components)
    const absComponentFile = componentFile ? path.join(REPO_ROOT, componentFile) : "";
    const namedExports = absComponentFile ? extractNamedExports(absComponentFile, name) : [];

    return {
        name,
        title,
        importPath,
        componentFile,
        storyFile,
        description,
        props,
        namedExports,
        usageExample,
        stories
    };
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function formatProp(prop: PropInfo): string {
    if (prop.options && prop.options.length > 0) {
        return `\`${prop.name}\`: ${prop.options.map((o) => `\`"${o}"\``).join(" | ")}`;
    }
    if (prop.type === "boolean") {
        return `\`${prop.name}\`: boolean`;
    }
    if (prop.type) {
        return `\`${prop.name}\`: ${prop.type}`;
    }
    return `\`${prop.name}\``;
}

function generateMarkdown(components: ComponentDoc[]): string {
    const lines: string[] = [
        "# Fern Dashboard UI Component Library",
        "",
        "> These are the **canonical UI components** for the fern-platform dashboard.",
        "> **NEVER** create new primitive components — always import from `@/components/ui/...`.",
        "> Always check this file before creating or designing any new UI component.",
        "",
        "## Rules",
        "",
        "- Never use raw `<button>`, `<input>`, `<select>`, or `<textarea>` elements — use the components below",
        "- Never create a new component if one already exists here",
        "- If a component you need is missing, ask before building a new one",
        "- All components live in `packages/fern-dashboard/src/components/`",
        "- Stories live alongside each component as `ComponentName.stories.tsx`",
        "",
        "## Storybook-first Workflow",
        "",
        "**IMPORTANT**: Always follow this workflow when reading or modifying any dashboard UI component:",
        "",
        "1. **Check for a story file first** — Before touching a component, glob for a `.stories.tsx` file alongside it (e.g. `MyComponent.stories.tsx`). If one exists, read it before reading the component source.",
        "2. **Read the story and component together** — Always read both the `.stories.tsx` and the component source file in parallel to understand existing variants, props, and documented behavior before making any changes.",
        "3. **Use stories as the source of truth for usage** — The stories define the intended API and visual variants of a component. Treat them as documentation. Do not add or change props/variants that aren't reflected in the stories (or update the stories accordingly).",
        "4. **Update or add stories for every component change** — Any new prop, variant, or behavior must have a corresponding story. Any modified behavior must have its story updated. Run `pnpm dashboard:storybook` to verify visually.",
        '5. **Never create a new component without a story** — All new dashboard UI components must include a `.stories.tsx` file with at least a `Default` story and `tags: ["autodocs"]`.',
        "",
        "---",
        ""
    ];

    // Group by Storybook category
    const grouped = new Map<string, ComponentDoc[]>();
    for (const comp of components) {
        const category = comp.title.split("/")[0] ?? "Other";
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category)!.push(comp);
    }

    for (const [category, comps] of grouped) {
        lines.push(`## ${category}`, "");

        for (const comp of comps) {
            lines.push(`### ${comp.name}`, "");

            // File pointers
            if (comp.componentFile) {
                lines.push(`- **Source:** \`${comp.componentFile}\``);
            }
            lines.push(`- **Stories:** \`${comp.storyFile}\``);
            lines.push("");

            // Import
            if (comp.importPath) {
                // If there are sub-components, show them all in the import
                const allExports = [comp.name, ...comp.namedExports];
                lines.push("```tsx");
                lines.push(`import { ${allExports.join(", ")} } from '${comp.importPath}';`);
                lines.push("```");
                lines.push("");
            }

            // Description
            if (comp.description) {
                lines.push(comp.description, "");
            }

            // Props
            if (comp.props.length > 0) {
                lines.push("**Props:**", "");
                for (const prop of comp.props) {
                    lines.push(`- ${formatProp(prop)}`);
                }
                lines.push("");
            }

            // Usage example
            if (comp.usageExample) {
                lines.push("**Usage:**", "");
                lines.push("```tsx");
                lines.push(comp.usageExample);
                lines.push("```");
                lines.push("");
            }

            // Story variants
            if (comp.stories.length > 0) {
                lines.push(`**Variants:** ${comp.stories.join(", ")}`, "");
            }
        }

        lines.push("---", "");
    }

    lines.push(
        `_Auto-generated by \`pnpm generate-ai-components-md\` — do not edit manually._`,
        `_Source: \`packages/fern-dashboard/scripts/generate-ai-components-md.ts\`_`,
        ""
    );

    return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const storyFiles = findStoryFiles(COMPONENTS_SRC).sort();
const docs: ComponentDoc[] = [];

for (const file of storyFiles) {
    const doc = parseStoryFile(file);
    if (doc) {
        docs.push(doc);
    }
}

docs.sort((a, b) => a.title.localeCompare(b.title));

const markdown = generateMarkdown(docs);
fs.writeFileSync(OUTPUT_PATH, markdown, "utf-8");

console.log(`✓ Wrote COMPONENTS.md with ${docs.length} components → ${OUTPUT_PATH}`);

import { parseStringStyle, visit } from "@fern-docs/mdx";
import { findChildren } from "@tiptap/core";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Element, Root } from "hast";
import {
    type BundledLanguage,
    type BundledTheme,
    bundledLanguages,
    getSingletonHighlighter,
    type Highlighter,
    type SpecialLanguage
} from "shiki";

const DEFAULT = Symbol("DEFAULT");

const THEMES: Record<"light" | "dark", Record<string | typeof DEFAULT, BundledTheme>> = {
    light: {
        [DEFAULT]: "min-light",
        diff: "github-light" // min-light does not work well for diff
    },
    dark: {
        [DEFAULT]: "material-theme-darker"
    }
};

const DARK_THEME_COLOR_REPLACEMENTS: Record<string, string> = {
    "#545454": "#8a8a8a"
};

let highlighter: Highlighter;

function parseLang(lang: string): string {
    lang = lang.trim();

    if (lang == null) {
        return "txt";
    }
    lang = lang.toLowerCase();
    if (Object.keys(bundledLanguages).includes(lang as BundledLanguage)) {
        return lang as BundledLanguage;
    }
    if (lang === "golang") {
        return "go";
    }
    if (lang === "curl") {
        return "bash";
    }
    return "txt";
}

async function getHighlighterInstance(language: string): Promise<Highlighter> {
    const lang = parseLang(language);

    if (highlighter == null) {
        highlighter = await getSingletonHighlighter();
    }

    await highlighter.loadTheme(THEMES.light[lang] ?? THEMES.light[DEFAULT], THEMES.dark[lang] ?? THEMES.dark[DEFAULT]);

    if (!highlighter.getLoadedLanguages().includes(lang)) {
        try {
            await highlighter.loadLanguage(lang as BundledLanguage | SpecialLanguage);
        } catch (e) {
            console.error(`Failed to load language: ${lang}`, e);
        }
    }

    return highlighter;
}

interface HighlightedTokens {
    code: string;
    lang: string;
    hast: Root;
}

function highlightTokens(highlighter: Highlighter, code: string, lang: string): HighlightedTokens {
    code = code.replace(/^\n+|\n+$/g, ""); // trim leading/trailing newlines
    lang = parseLang(lang);
    const hast = highlighter.codeToHast(code, {
        lang,
        themes: {
            light: THEMES.light[lang] ?? THEMES.light[DEFAULT],
            dark: THEMES.dark[lang] ?? THEMES.dark[DEFAULT]
        },
        colorReplacements: DARK_THEME_COLOR_REPLACEMENTS
    });
    return { code, lang, hast };
}

interface ShikiPluginState {
    decorationSet: DecorationSet;
    loadedLanguages: Set<string>;
}

function getDecorationsFromTokens(tokens: HighlightedTokens, blockPos: number): Decoration[] {
    const decorations: Decoration[] = [];
    let from = blockPos + 1;

    const lines: Element[] = [];
    visit(tokens.hast, "element", (node) => {
        if (node.tagName === "code") {
            node.children.forEach((child) => {
                if (child.type === "element" && child.tagName === "span") {
                    lines.push(child);
                }
            });
        }
    });

    const styleToString = (styleObj: Record<string, string>): string => {
        return Object.entries(styleObj)
            .map(([key, value]) => `${key}: ${value}`)
            .join("; ");
    };

    const traverse = (node: any, styleObj: Record<string, string>): void => {
        if (node.type === "text") {
            const len = node.value.length;
            if (len > 0) {
                const styleStr = styleToString(styleObj);
                if (styleStr) {
                    decorations.push(
                        Decoration.inline(from, from + len, {
                            style: styleStr
                        })
                    );
                }
                from += len;
            }
        } else if (node.type === "element") {
            let nextStyle = styleObj;
            if (node.tagName === "span") {
                const parsedStyle = parseStringStyle(node.properties?.style);
                if (parsedStyle) {
                    nextStyle = { ...styleObj, ...parsedStyle };
                }
            }
            if (node.children) {
                for (const child of node.children) {
                    traverse(child, nextStyle);
                }
            }
        }
    };

    lines.forEach((line, lineIndex) => {
        traverse(line, {});

        if (lineIndex < lines.length - 1) {
            from += 1;
        }
    });

    return decorations;
}

async function getDecorationsAsync({
    doc,
    name,
    defaultLanguage,
    loadedLanguages
}: {
    doc: ProsemirrorNode;
    name: string;
    defaultLanguage: string | null | undefined;
    loadedLanguages: Set<string>;
}): Promise<{ decorations: DecorationSet; newLoadedLanguages: Set<string> }> {
    const decorations: Decoration[] = [];
    const newLoadedLanguages = new Set(loadedLanguages);

    const blocks = findChildren(doc, (node) => node.type.name === name);

    for (const block of blocks) {
        const language = block.node.attrs.language || defaultLanguage || "plaintext";
        const lang = parseLang(language === "null" ? "plaintext" : language);

        try {
            const highlighter = await getHighlighterInstance(lang);
            newLoadedLanguages.add(lang);

            const tokens = highlightTokens(highlighter, block.node.textContent, lang);

            const blockDecorations = getDecorationsFromTokens(tokens, block.pos);
            decorations.push(...blockDecorations);
        } catch (e) {
            console.error(`Failed to highlight code block with language: ${lang}`, e);
        }
    }

    return {
        decorations: DecorationSet.create(doc, decorations),
        newLoadedLanguages
    };
}

function getDecorationsSync({ doc, name }: { doc: ProsemirrorNode; name: string }): DecorationSet {
    return DecorationSet.empty;
}

export function ShikiPlugin({ name, defaultLanguage }: { name: string; defaultLanguage: string | null | undefined }) {
    let editorView: EditorView | null = null;
    let latestUpdateToken = 0;

    const shikiPlugin: Plugin<ShikiPluginState> = new Plugin({
        key: new PluginKey("shiki"),

        state: {
            init: (_, { doc }) => {
                const state: ShikiPluginState = {
                    decorationSet: getDecorationsSync({ doc, name }),
                    loadedLanguages: new Set()
                };

                return state;
            },
            apply: (transaction, state, oldState, newState) => {
                const meta = transaction.getMeta("shiki-decorations");
                if (meta) {
                    return {
                        decorationSet: meta.decorations,
                        loadedLanguages: meta.loadedLanguages
                    };
                }

                const oldNodeName = oldState.selection.$head.parent.type.name;
                const newNodeName = newState.selection.$head.parent.type.name;
                const oldNodes = findChildren(oldState.doc, (node) => node.type.name === name);
                const newNodes = findChildren(newState.doc, (node) => node.type.name === name);

                const shouldRecompute =
                    transaction.docChanged &&
                    ([oldNodeName, newNodeName].includes(name) ||
                        newNodes.length !== oldNodes.length ||
                        transaction.steps.some((step) => {
                            return (
                                // @ts-expect-error misc type issue from tiptap
                                step.from !== undefined &&
                                // @ts-expect-error misc type issue from tiptap
                                step.to !== undefined &&
                                oldNodes.some((node) => {
                                    return (
                                        // @ts-expect-error misc type issue from tiptap
                                        node.pos >= step.from &&
                                        // @ts-expect-error misc type issue from tiptap
                                        node.pos + node.node.nodeSize <= step.to
                                    );
                                })
                            );
                        }));

                if (shouldRecompute && editorView) {
                    const token = ++latestUpdateToken;
                    void getDecorationsAsync({
                        doc: transaction.doc,
                        name,
                        defaultLanguage,
                        loadedLanguages: state.loadedLanguages
                    })
                        .then(({ decorations, newLoadedLanguages }) => {
                            if (token !== latestUpdateToken) {
                                return;
                            }
                            if (editorView && !editorView.isDestroyed) {
                                const tr = editorView.state.tr;
                                tr.setMeta("shiki-decorations", {
                                    decorations,
                                    loadedLanguages: newLoadedLanguages
                                });
                                editorView.dispatch(tr);
                            }
                        })
                        .catch((e) => {
                            console.error("Failed to update syntax highlighting:", e);
                        });

                    return {
                        decorationSet: state.decorationSet.map(transaction.mapping, transaction.doc),
                        loadedLanguages: state.loadedLanguages
                    };
                }

                return {
                    decorationSet: state.decorationSet.map(transaction.mapping, transaction.doc),
                    loadedLanguages: state.loadedLanguages
                };
            }
        },

        view(view) {
            editorView = view;

            void getDecorationsAsync({
                doc: view.state.doc,
                name,
                defaultLanguage,
                loadedLanguages: new Set()
            })
                .then(({ decorations, newLoadedLanguages }) => {
                    if (editorView && !editorView.isDestroyed) {
                        const tr = editorView.state.tr;
                        tr.setMeta("shiki-decorations", {
                            decorations,
                            loadedLanguages: newLoadedLanguages
                        });
                        editorView.dispatch(tr);
                    }
                })
                .catch((e) => {
                    console.error("Failed to initialize syntax highlighting:", e);
                });

            return {
                destroy() {
                    editorView = null;
                }
            };
        },

        props: {
            decorations(state) {
                return shikiPlugin.getState(state)?.decorationSet;
            }
        }
    });

    return shikiPlugin;
}

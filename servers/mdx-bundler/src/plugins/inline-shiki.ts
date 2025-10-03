import type { RehypeShikiCoreOptions } from "@shikijs/rehype/core";
import type { Element, Root } from "hast";
import type { BuiltinLanguage, BuiltinTheme, BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { bundledLanguages, getSingletonHighlighter } from "shiki";
import type { LanguageInput } from "shiki/core";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const inlineShikiRegex = /(.*){:(.*)}$/;

export type RehypeInlineShikiOptions = RehypeShikiCoreOptions & {
    /**
     * Language names to include.
     *
     * @default Object.keys(bundledLanguages)
     */
    langs?: (LanguageInput | BuiltinLanguage)[];
};

let promise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>;

export const rehypeInlineShiki: Plugin<[RehypeInlineShikiOptions], Root> = (
    options = {} as RehypeInlineShikiOptions
) => {
    const themeNames = ("themes" in options ? Object.values(options.themes) : [options.theme]).filter(
        Boolean
    ) as BuiltinTheme[];
    const langs = options.langs || Object.keys(bundledLanguages);

    return async (tree) => {
        if (promise === undefined)
            promise = getSingletonHighlighter({
                themes: themeNames,
                langs
            });
        const highlighter = await promise;
        return visit(tree, "element", (node, index, parent) => {
            if (node.tagName !== "code") return;

            const firstChild = node.children[0];
            if (firstChild?.type !== "text") return;
            const match = firstChild.value.match(inlineShikiRegex);
            if (!match) return;

            const [, code, lang] = match;
            if (!code || !lang) return;
            const hast = highlighter.codeToHast(code, { ...options, lang });

            const inlineCode = (hast.children[0] as Element).children[0];
            if (!inlineCode) return;

            parent?.children.splice(index ?? 0, 1, inlineCode);
        });
    };
};

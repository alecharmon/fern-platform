import type { Root } from "mdast";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

export function MarkdownContent({
    children,
    components,
    citations,
    plugins
}: {
    children: string;
    components?: Components;
    citations?: {
        start: number;
        end: number;
        text: string;
        url: string;
    }[];
    plugins?: string[];
}) {
    /*
    Claude 3.5 sometimes doesn't create footnote definitions correctly
    remark-gfm requires that footnotes look like [^1] in the text
    and then [^1]: link in the footnote, whereas Claude 3.5 will sometimes
    create [^1]: link in the main text, which breaks the markdown rendering.

    This code will regex for improperly placed links, and then move them to the end
  */
    let cleanedContent = children;
    const footnoteDefinitions: string[] = [];
    cleanedContent = cleanedContent.replace(
        /\[\^(\d+)\]:\s+([a-zA-Z][^\s]*?\.[a-zA-Z][^\s]*?)(?=\n\n|\n[^\n]|$)/g,
        (match, footnoteNumber, link) => {
            footnoteDefinitions.push(
                `[^${footnoteNumber}]: ${link.startsWith("http") ? link.trim() : `https://${link.trim()}`}`
            );
            return `[^${footnoteNumber}]\n`;
        }
    );
    if (footnoteDefinitions.length > 0) {
        cleanedContent = cleanedContent + "\n\n" + footnoteDefinitions.join("\n");
    }

    if (citations && citations.length > 0) {
        let urlIndex = 1;
        let seenIndices: Record<string, boolean> = {};
        for (const citation of citations) {
            if (!(citation.url in seenIndices)) {
                cleanedContent = cleanedContent + ` [^${urlIndex}]`;
                seenIndices[citation.url] = true;
                urlIndex++;
            }
        }
        urlIndex = 1;
        seenIndices = {};
        for (const [_, citation] of citations.entries()) {
            const cleanedUrl = citation.url.startsWith("https") ? citation.url : `https://${citation.url}`;
            if (!seenIndices[citation.url]) {
                cleanedContent = cleanedContent + `\n\n[^${urlIndex}]: ${cleanedUrl}`;
                seenIndices[citation.url] = true;
                urlIndex++;
            }
        }
    }

    const remarkPlugins = [];
    if (plugins) {
        if (plugins.includes("remarkGfm")) {
            remarkPlugins.push(remarkGfm);
        }
        if (plugins.includes("remarkTest")) {
            remarkPlugins.push(remarkTest);
        }
    }

    // note: for code snippets, if you put a footnote on the same line as the code block end
    // it will break the code rendering, so we clean manually by moving the footnote to a new line
    cleanedContent = cleanedContent.replace(/```[ \t]*\[\^/g, "```\n[^");

    return (
        <Markdown components={components} remarkPlugins={remarkPlugins} remarkRehypeOptions={{}}>
            {cleanedContent}
        </Markdown>
    );
}

function remarkTest() {
    return (tree: Root) => {
        visit(tree, "text", (node) => {
            // Remove footnote references that aren't parsed
            const match = node.value.matchAll(/\[\^[0-9]+\]/g);
            if (match) {
                for (const m of match) {
                    node.value = node.value.replace(m[0], "");
                }
            }

            // remove all partial brackets
            const bracketMatch = node.value.matchAll(/\[.*$|!\[.*$/g);
            if (bracketMatch) {
                for (const m of bracketMatch) {
                    if (!m[0].endsWith("]")) {
                        node.value = node.value.replace(m[0], "");
                    }
                }
            }
        });
    };
}

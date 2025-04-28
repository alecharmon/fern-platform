import Markdown, { type Components } from "react-markdown";

import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

export function MarkdownContent({
  children,
  components,
}: {
  children: string;
  components?: Components;
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
    /\[\^(\d+)\]:\s+(.*?)(?=\n\n|\n[^\n]|$)/g,
    (match, footnoteNumber, link) => {
      footnoteDefinitions.push(
        `[^${footnoteNumber}]: ${link.startsWith("http") ? link.trim() : `https://${link.trim()}`}`
      );
      return `[^${footnoteNumber}]\n`;
    }
  );
  if (footnoteDefinitions.length > 0) {
    cleanedContent =
      cleanedContent.trim() + "\n\n" + footnoteDefinitions.join("\n");
  }

  return (
    <Markdown
      components={components}
      remarkPlugins={[remarkGfm, remarkTest]}
      remarkRehypeOptions={{}}
    >
      {cleanedContent.replaceAll("```[^", "```\n[^")}
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

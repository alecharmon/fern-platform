import {
  CONTINUE,
  Hast,
  Unified,
  isMdxJsxElementHast,
  visit,
} from "@fern-docs/mdx";

/**
 * Rehype plugin that converts component names for the editor environment.
 * This reverses the transformations done by the normal plugins:
 * - CardGroup -> Cards
 * - AccordionGroup -> Accordion
 * - TabGroup -> Tabs
 * - StepGroup -> Steps
 */
export const rehypeEditorComponents: Unified.Plugin<[], Hast.Root> = () => {
  return (ast: Hast.Root) => {
    visit(ast, (node) => {
      if (!isMdxJsxElementHast(node)) {
        return CONTINUE;
      }

      if (node.name === "Cards") {
        node.name = "CardGroup";
      }

      if (node.name === "Accordions") {
        node.name = "AccordionGroup";
      }

      if (node.name === "Tabs") {
        node.name = "TabGroup";
      }

      return CONTINUE;
    });
  };
};

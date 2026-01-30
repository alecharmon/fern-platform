import type { Root } from "hast";
import { CONTINUE, SKIP, visit } from "unist-util-visit";

import { isMdxExpression } from "../mdx-utils";
import type { Unified } from "../unified";

function isCommentExpression(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.startsWith("/*") && trimmed.endsWith("*/");
}

export const rehypeRemoveMdxComments: Unified.Plugin<[], Root> = () => {
    return (root) => {
        visit(root, (node, index, parent) => {
            if (index == null || parent == null) {
                return CONTINUE;
            }

            if (isMdxExpression(node) && isCommentExpression(node.value)) {
                parent.children.splice(index, 1);
                return [SKIP, index];
            }

            return CONTINUE;
        });
    };
};

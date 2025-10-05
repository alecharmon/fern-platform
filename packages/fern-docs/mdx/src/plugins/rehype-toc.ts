/**
 * A rehype plugin to inject a table of contents into the MDX file.
 *
 * This makes it possible to leverage https://github.com/kentcdodds/mdx-bundler?tab=readme-ov-file#accessing-named-exports on the frontend
 *
 * Inspired by https://github.com/remcohaszing/remark-mdx-frontmatter/blob/main/src/remark-mdx-frontmatter.ts
 */
import { valueToEstree } from "estree-util-value-to-estree";
import type { Root } from "hast";
import type { Plugin } from "unified";

import { makeToc } from "../toc";

interface MdxjsEsmData {
    estree: {
        body: {
            declaration: {
                declarations: {
                    init: {
                        properties: {
                            key: { value: string };
                            value: { value: number };
                        }[];
                    };
                }[];
            };
        }[];
    };
}

export const rehypeToc: Plugin<[], Root> = () => {
    return (ast) => {
        const exportNode = ast.children.find(
            (node) => node.type === "mdxjsEsm" && node.data?.estree?.body?.[0]?.type === "ExportNamedDeclaration"
        );

        // extract max-toc-depth from frontmatter if present
        const maxTocDepth = (
            exportNode?.data as MdxjsEsmData
        )?.estree?.body?.[0]?.declaration?.declarations?.[0]?.init?.properties?.find(
            (prop) => prop.key?.value === "max-toc-depth"
        )?.value?.value;

        const toc = makeToc(ast, false, maxTocDepth);

        ast.children.unshift({
            type: "mdxjsEsm",
            value: "",
            data: {
                estree: {
                    type: "Program",
                    sourceType: "module",
                    body: [
                        {
                            type: "ExportNamedDeclaration", // this will make it possible to access the toc variable in the frontend
                            specifiers: [],
                            declaration: {
                                type: "VariableDeclaration",
                                kind: "const",
                                declarations: [
                                    {
                                        type: "VariableDeclarator",
                                        id: { type: "Identifier", name: "toc" },
                                        init: valueToEstree(toc, { preserveReferences: true })
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        });
    };
};

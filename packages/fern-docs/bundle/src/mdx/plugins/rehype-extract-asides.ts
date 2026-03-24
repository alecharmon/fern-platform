import { logger } from "@fern-api/ui-core-utils/logger";
import {
    type Estree,
    extractJsx,
    extractJsxFromEstree,
    type Hast,
    isMdxJsxElementHast,
    SKIP,
    type Unified,
    visit
} from "@fern-docs/mdx";
import { toEstree } from "hast-util-to-estree";

/**
 * Extracts all the children of an <Aside> tag and replaces it with a new <Main> and <Aside> tag
 */
export const rehypeExtractAsides: Unified.Plugin<[], Hast.Root> = () => {
    return (ast) => {
        // Extract module-level ESM bindings from the full AST before extracting the Aside content.
        // This includes imports and other top-level declarations that define component names.
        // We need to filter these out to avoid shadowing imported custom components.
        const moduleBindings = extractJsx(ast);
        const moduleEsmBindings = new Set(moduleBindings.esmElements);

        const asides: Hast.ElementContent[] = [];
        visit(ast, (node, index, parent) => {
            if (!isMdxJsxElementHast(node) || node.name !== "Aside" || index == null || parent == null) {
                return true;
            }
            // delete the <Aside> tag from the tree
            parent.children.splice(index, 1);
            // ignore the <Aside> tag itself, and extract all its children
            asides.push(...node.children);
            return SKIP;
        });
        // // if there are no asides, don't do anything
        if (asides.length === 0) {
            return;
        }
        try {
            // replace the original tree with a new tree that has the main and aside elements
            const program = toEstree({
                type: "mdxJsxFlowElement",
                name: null,
                attributes: [],
                children: asides
            });

            const expressionStatement = program.body.find((statement) => statement.type === "ExpressionStatement");
            if (!expressionStatement) {
                throw new Error("No expression statement found");
            }
            const extracted = extractJsxFromEstree(program);
            const jsxFragment = expressionStatement.expression;
            if (!jsxFragment || jsxFragment.type !== "JSXFragment") {
                throw new Error("No JSXFragment found");
            }
            // Filter out JSX elements that are already defined at module scope (e.g., imported custom components).
            // This prevents the generated Aside component from shadowing these imports with undefined values
            // from useMDXComponents(), which would cause "Something went wrong!" errors.
            const jsxElementsToDestructure = extracted.jsxElements.filter((name) => !moduleEsmBindings.has(name));
            ast.children.push(mdxJsEsmExport("Aside", jsxFragment, jsxElementsToDestructure));
        } catch (e) {
            logger.error(`[rehype-extract-asides] ${String(e)}`);
        }
    };
};

function mdxJsEsmExport(name: string, fragment: Estree.JSXFragment, identifiers: string[] = []): Hast.MdxjsEsm {
    return {
        type: "mdxjsEsm",
        value: "",
        data: {
            estree: {
                type: "Program",
                sourceType: "module",
                body: [
                    {
                        type: "FunctionDeclaration",
                        id: {
                            type: "Identifier",
                            name: `${name}Component`
                        },
                        generator: false,
                        async: false,
                        params: [],
                        body: {
                            type: "BlockStatement",
                            body: [
                                {
                                    type: "VariableDeclaration",
                                    declarations: [
                                        {
                                            type: "VariableDeclarator",
                                            id: {
                                                type: "ObjectPattern",
                                                properties: identifiers.map(
                                                    (name) =>
                                                        ({
                                                            type: "Property",
                                                            method: false,
                                                            shorthand: true,
                                                            computed: false,
                                                            key: { type: "Identifier", name },
                                                            kind: "init",
                                                            value: { type: "Identifier", name }
                                                        }) as const
                                                )
                                            },
                                            init: {
                                                type: "CallExpression",
                                                callee: {
                                                    type: "MemberExpression",
                                                    object: {
                                                        type: "Identifier",
                                                        name: "MdxJsReact"
                                                    },
                                                    property: {
                                                        type: "Identifier",
                                                        name: "useMDXComponents"
                                                    },
                                                    computed: false,
                                                    optional: false
                                                },
                                                arguments: [],
                                                optional: false
                                            }
                                        }
                                    ],
                                    kind: "const"
                                },
                                {
                                    type: "ReturnStatement",
                                    argument: fragment
                                }
                            ]
                        }
                    },
                    {
                        type: "ExportNamedDeclaration",
                        declaration: {
                            type: "VariableDeclaration",
                            declarations: [
                                {
                                    type: "VariableDeclarator",
                                    id: {
                                        type: "Identifier",
                                        name: name
                                    },
                                    init: {
                                        type: "Identifier",
                                        name: `${name}Component`
                                    }
                                }
                            ],
                            kind: "const"
                        },
                        specifiers: [],
                        source: null
                    }
                ]
            }
        }
    };
}

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import {
    CONTINUE,
    type Hast,
    hastMdxJsxElementHastToProps,
    isMdxJsxElementHast,
    SKIP,
    type Unified,
    unknownToMdxJsxAttribute,
    visit
} from "@fern-docs/mdx";

/**
 * This plugin is used to add the `typeDefinition` and `types`
 * props to a `Schema` node. This is necessary to hydrate the
 * `Schema` node with the correct prop values to render.
 */
export const rehypeSchema: Unified.Plugin<[{ loader: DocsLoader }?], Hast.Root> = (opts) => {
    if (!opts?.loader) {
        return;
    }
    const loader = opts.loader;

    return async (ast: Hast.Root) => {
        const promises: Promise<void>[] = [];

        visit(ast, (node, index, parent) => {
            if (!isMdxJsxElementHast(node) || index == null || parent == null) {
                return CONTINUE;
            }

            if (node.name != null && node.name === "Schema") {
                const { props } = hastMdxJsxElementHastToProps(node);

                if (typeof props.type !== "string") {
                    return CONTINUE;
                }

                const typeName = props.type.trim();

                promises.push(
                    (async () => {
                        try {
                            const typeDefinitions = await loader.getTypes();

                            for (const typeEntry of Object.entries(typeDefinitions)) {
                                const [_typeEntryId, typeEntryDef] = typeEntry;
                                // Match by the type's name field, not the TypeId key
                                if (typeEntryDef.name === typeName) {
                                    node.attributes.push(
                                        unknownToMdxJsxAttribute("typeDefinition", typeEntryDef),
                                        unknownToMdxJsxAttribute("types", typeDefinitions)
                                    );
                                    return;
                                }
                            }

                            console.error(
                                `Could not find type with name "${typeName}". Available types: ${Object.entries(
                                    typeDefinitions
                                )
                                    .map(([_, def]) => def.name)
                                    .join(", ")}`
                            );
                        } catch (e) {
                            console.error(`Could not find type "${typeName}"`, e);
                        }
                    })()
                );

                return SKIP;
            }
            return CONTINUE;
        });
        if (promises.length > 0) {
            // wait for all promises to resolve before proceeding
            await Promise.all(promises);
        }
    };
};

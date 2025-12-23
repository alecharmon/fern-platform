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
 * This rehype plugin processes `WebhookPayloadSnippet` components in MDX content.
 * It looks up the webhook definition by the provided `webhook` prop (ID or path)
 * and injects the full webhook definition into the component props.
 */
export const rehypeWebhookPayloadSnippet: Unified.Plugin<[{ loader: DocsLoader }?], Hast.Root> = (opts) => {
    if (!opts) {
        return;
    }
    const loader = opts.loader;

    return async (ast: Hast.Root) => {
        const promises: Promise<void>[] = [];

        visit(ast, (node, index, parent) => {
            if (!isMdxJsxElementHast(node) || index == null || parent == null) {
                return CONTINUE;
            }

            const isWebhookPayloadSnippet = node.name === "WebhookPayloadSnippet";

            if (isWebhookPayloadSnippet) {
                const { props } = hastMdxJsxElementHastToProps(node);

                // cannot parse non-string webhook prop
                if (typeof props.webhook !== "string") {
                    return CONTINUE;
                }

                const webhookId = props.webhook;

                promises.push(
                    (async () => {
                        try {
                            const result = await loader.getWebhookByLocator(webhookId);

                            if (result != null) {
                                node.attributes.push(
                                    unknownToMdxJsxAttribute("webhookDefinition", result.webhook),
                                    unknownToMdxJsxAttribute("slug", result.slug)
                                );
                            } else {
                                console.warn(`Could not find webhook for ${webhookId}`);
                            }
                        } catch (e) {
                            console.error(`Error looking up webhook ${webhookId}`, e);
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

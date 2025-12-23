import type { ApiDefinition } from "@fern-api/fdr-sdk";
import { CodeSnippetExample } from "@fern-docs/components/api-reference/examples/CodeSnippetExample";
import { cn } from "@fern-docs/components/cn";
import { t } from "@fern-docs/i18n";

export function WebhookPayloadSnippet({
    webhookDefinition,
    slug,
    className,
    lang
}: {
    /**
     * The webhook locator to use for the payload snippet.
     * This can be the webhook ID or path.
     */
    webhook?: string;
    /**
     * @internal the rehype-webhook-payload-snippet plugin will set this
     */
    webhookDefinition?: ApiDefinition.WebhookDefinition;
    /**
     * The slug of the webhook.
     */
    slug: string | undefined;
    className?: string;
    lang?: string;
}) {
    if (webhookDefinition == null) {
        return null;
    }

    return (
        <WebhookPayloadSnippetInternal
            webhook={webhookDefinition}
            slug={slug}
            className={className}
            lang={lang ?? "en"}
        />
    );
}

function WebhookPayloadSnippetInternal({
    webhook,
    slug,
    className,
    lang
}: {
    slug: string | undefined;
    webhook: ApiDefinition.WebhookDefinition;
    className?: string;
    lang: string;
}) {
    const example = webhook.examples?.[0];

    if (example == null) {
        return null;
    }

    const payloadJson = example.payload;

    if (payloadJson == null) {
        return null;
    }

    const payloadJsonString = JSON.stringify(payloadJson, null, 2);

    return (
        <div className={cn("mb-5 mt-3", className)}>
            <CodeSnippetExample
                title={t(lang).apiReference.payload}
                code={payloadJsonString}
                language="json"
                json={payloadJson}
                scrollAreaStyle={{ maxHeight: "500px" }}
                slug={slug}
                lang={lang}
            />
        </div>
    );
}

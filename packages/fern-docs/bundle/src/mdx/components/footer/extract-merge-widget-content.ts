import { isValidRequestType, type RequestType } from "@/mdx/merge-widget-utils";

/**
 * Extracts <MergeSupportedFieldsByIntegrationWidget /> tags from an MDX string.
 *
 * This removes the widget from the description so it can be rendered outside
 * the MDX compilation pipeline, avoiding the Suspense fallback flash caused
 * by the widget's large base64 gzip data payload.
 *
 * @param description - The MDX description string that may contain the widget tag
 * @returns The description without the widget and the parsed widget props (if found)
 */
export function extractMergeWidgetContent(description: string | null | undefined): {
    description: string | null | undefined;
    widgetProps: { data: string; requestType?: RequestType } | null;
} {
    if (!description) {
        return { description, widgetProps: null };
    }

    // Match self-closing <MergeSupportedFieldsByIntegrationWidget ... /> tags
    const widgetRegex = /<MergeSupportedFieldsByIntegrationWidget\s+([^>]*?)\/>/g;
    const match = widgetRegex.exec(description);

    if (!match?.[1]) {
        return { description, widgetProps: null };
    }

    const attrs = match[1];
    const dataMatch = /data="([^"]*)"/.exec(attrs);

    if (!dataMatch?.[1]) {
        return { description, widgetProps: null };
    }

    const requestTypeMatch = /requestType="([^"]*)"/.exec(attrs);
    const extractedRequestType = requestTypeMatch?.[1];

    // Remove the widget tag from the description
    const descriptionWithoutWidget = description.replace(widgetRegex, "").trim();

    return {
        description: descriptionWithoutWidget || null,
        widgetProps: {
            data: dataMatch[1],
            requestType:
                extractedRequestType && isValidRequestType(extractedRequestType) ? extractedRequestType : undefined
        }
    };
}

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";

import { MergeSupportedFieldsByIntegrationWidget } from "@/mdx/components/snippets/MergeSupportedFieldsByIntegrationWidget";
import { decodeWidgetData, type RequestType, resolveWidgetTypeData } from "@/mdx/merge-widget-utils";

/**
 * Server component that resolves widget data directly in the Server Component tree,
 * bypassing the MDX compilation pipeline and its Suspense fallback.
 */
export async function MergeSupportedFieldsByIntegrationServer({
    loader,
    data,
    requestType,
    lang
}: {
    loader: DocsLoader;
    data: string;
    requestType?: RequestType;
    lang: string;
}) {
    const decodedData = decodeWidgetData(data);
    if (decodedData == null) {
        return null;
    }

    const resolved = await resolveWidgetTypeData(loader, decodedData);
    if (resolved == null) {
        return null;
    }

    return (
        <MergeSupportedFieldsByIntegrationWidget
            data={data}
            decodedData={decodedData}
            typeDefinition={resolved.typeDefinition}
            types={resolved.types}
            requestType={requestType}
            lang={lang}
        />
    );
}

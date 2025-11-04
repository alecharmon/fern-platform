import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import NotFoundContent from "@/components/NotFoundContent";

export const dynamic = "force-dynamic";

export default async function NotFound({ params }: { params: Promise<{ host: string; domain: string }> }) {
    const { host, domain } = await params;
    const loader = await createCachedDocsLoader(host, domain);
    const lang = await loader.getLanguage();

    return <NotFoundContent lang={lang} />;
}

import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";

import { getFernToken } from "@/app/fern-token";
import SharedPage from "@/components/shared-page";

export default async function DynamicPage(props: {
  params: Promise<{ host: string; domain: string; slug: string }>;
}) {
  const { host, domain, slug } = await props.params;

  const loader = await createCachedDocsLoader(
    host,
    domain,
    await getFernToken()
  );
  return <SharedPage loader={loader} slug={slugjoin(slug)} />;
}

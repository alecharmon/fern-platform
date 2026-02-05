import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { FooterLinks } from "@fern-docs/components/footer/FooterLinks";

export async function CustomFooterLinks({ loader, className }: { loader: DocsLoader; className?: string }) {
    return <FooterLinks loader={loader} className={className} />;
}

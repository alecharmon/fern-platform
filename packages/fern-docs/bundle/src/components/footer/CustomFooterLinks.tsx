import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { FooterLinks } from "@fern-docs/components/footer/FooterLinks";
import { CustomComponent } from "@/components/custom-component";
import { compileTsx } from "@/components/custom-component/compile-tsx";

export async function CustomFooterLinks({ loader, className }: { loader: DocsLoader; className?: string }) {
    const config = await loader.getConfig();
    const jsFiles = await loader.getMdxBundlerFiles();

    // Check if there's a custom footer component
    if (config.footer != null) {
        const footerSource = jsFiles[config.footer];
        if (footerSource != null) {
            try {
                const compiledFooterCode = await compileTsx(footerSource, config.footer);
                return (
                    <FooterLinks
                        loader={loader}
                        className={className}
                        customFooter={<CustomComponent code={compiledFooterCode} componentType="footer" />}
                    />
                );
            } catch (err) {
                console.error("[CustomFooterLinks] Failed to compile custom footer:", err);
            }
        } else {
            console.warn(`[CustomFooterLinks] Custom footer path "${config.footer}" not found in jsFiles`);
        }
    }

    // Fall back to default footer links
    return <FooterLinks loader={loader} className={className} />;
}

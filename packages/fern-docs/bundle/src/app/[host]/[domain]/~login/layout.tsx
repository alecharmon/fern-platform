import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { createFileResolver } from "@fern-api/docs-server/file-resolver";
import { cn } from "@fern-docs/components/cn";
import { FERN_FOOTER_ID } from "@fern-docs/components/constants";
import { ThemeSwitch } from "@fern-docs/components/header/theme-switch";
import { FernHeader } from "@fern-docs/components/theming/fern-header";

import { Logo } from "@/components/logo";
import { withLogo } from "@/server/withLogo";

export default async function LoginLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ host: string; domain: string }>;
}) {
    const { host, domain } = await params;
    const loader = await createCachedDocsLoader(host, domain);

    const [{ basePath }, config, files, logoUrls, _colors, lang] = await Promise.all([
        loader.getMetadata(),
        loader.getConfig(),
        loader.getFiles(),
        loader.getLogoUrls(),
        loader.getColors(),
        loader.getLanguage()
    ]);

    const resolveFileSrc = createFileResolver(files);
    const logo = withLogo(config, resolveFileSrc, basePath, undefined, logoUrls);

    return (
        <>
            <div className="fern-background-image pointer-events-none fixed inset-0" />
            <FernHeader className="fern-background-image" data-theme="default">
                <div className="width-before-scroll-bar">
                    <div className="fern-header-content">
                        <div
                            className={cn(
                                "flex w-full flex-col items-center justify-stretch gap-4",
                                "max-w-page-width mx-auto"
                            )}
                        >
                            <div className="flex w-full items-center justify-between gap-4">
                                <div className="fern-header-logo-container">
                                    <Logo logo={logo} className="w-fit shrink-0" />
                                </div>
                                <ThemeSwitch iconOnly variant="ghost" className="ml-2" lang={lang} />
                            </div>
                        </div>
                    </div>
                </div>
            </FernHeader>

            <main className="mt-(--header-height) relative z-0 flex" data-theme="default">
                {children}
            </main>

            <footer id={FERN_FOOTER_ID} className="width-before-scroll-bar" />
        </>
    );
}

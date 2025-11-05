import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";

import SharedLayout from "@/components/shared-layout";

export default async function Layout({
    children,
    params,
    headertabs,
    sidebar,
    versionSelect,
    productSelect,
    languageSelect,
    logo,
    explorer
}: {
    children: React.ReactNode;
    params: Promise<{ host: string; domain: string }>;
    headertabs: React.ReactNode;
    sidebar: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    languageSelect: React.ReactNode;
    logo: React.ReactNode;
    explorer: React.ReactNode;
}) {
    const { host, domain } = await params;
    const loader = await createCachedDocsLoader(host, domain);
    const lang = await loader.getLanguage();
    return (
        <SharedLayout
            loader={loader}
            lang={lang}
            headertabs={headertabs}
            versionSelect={versionSelect}
            productSelect={productSelect}
            languageSelect={languageSelect}
            sidebar={sidebar}
            logo={logo}
        >
            {children}
            {explorer}
        </SharedLayout>
    );
}

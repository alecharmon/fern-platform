import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { SetLoggedIn } from "@fern-docs/components/state/logged-in";
import { SetRoles } from "@fern-docs/components/state/roles";

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
    explorer,
    announcement
}: {
    children: React.ReactNode;
    params: Promise<{ host: string; domain: string; requiresLogin: string; isLoggedIn: string; roles: string }>;
    headertabs: React.ReactNode;
    sidebar: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    languageSelect: React.ReactNode;
    logo: React.ReactNode;
    explorer: React.ReactNode;
    announcement: React.ReactNode;
}) {
    const { host, domain, ...authParams } = await params;
    const { roles, isLoggedIn, requiresLogin } = decodeAuthContextFromParams(authParams);

    const loader = await createCachedDocsLoader(host, domain, undefined, { roles, isLoggedIn, requiresLogin });

    return (
        <>
            <SetRoles value={roles} />
            <SetLoggedIn value={isLoggedIn} />
            <SharedLayout
                loader={loader}
                headertabs={headertabs}
                versionSelect={versionSelect}
                productSelect={productSelect}
                languageSelect={languageSelect}
                sidebar={sidebar}
                logo={logo}
                announcement={announcement}
            >
                {children}
                {explorer}
            </SharedLayout>
        </>
    );
}

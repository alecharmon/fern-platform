import "server-only";

import { SharedLayout } from "@/app/[host]/[domain]/shared-layout";

export default async function Layout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ host: string; domain: string }>;
}) {
    const { host, domain } = await params;
    return (
        <SharedLayout host={host} domain={domain} isPrintView>
            {children}
        </SharedLayout>
    );
}

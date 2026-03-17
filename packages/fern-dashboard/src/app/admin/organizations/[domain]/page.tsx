import { Suspense } from "react";

import { DeploymentsPanel } from "./DeploymentsPanel";

export default function AdminDeploymentsPage({
    params,
    searchParams
}: {
    params: Promise<{ domain: string }>;
    searchParams: Promise<{ basepath?: string; page?: string }>;
}) {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <DeploymentsContent params={params} searchParams={searchParams} />
        </Suspense>
    );
}

async function DeploymentsContent({
    params,
    searchParams
}: {
    params: Promise<{ domain: string }>;
    searchParams: Promise<{ basepath?: string; page?: string }>;
}) {
    const { domain } = await params;
    const decodedDomain = decodeURIComponent(domain);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-semibold">Deployments</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Audit log for <span className="font-medium text-foreground">{decodedDomain}</span>
                </p>
            </div>
            <DeploymentsPanel domain={decodedDomain} searchParams={searchParams} />
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
            <div className="bg-muted h-64 animate-pulse rounded-md" />
        </div>
    );
}

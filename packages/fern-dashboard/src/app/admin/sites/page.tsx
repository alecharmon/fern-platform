import { Suspense } from "react";

import { SitesPanel } from "./SitesPanel";

export default function AdminSitesPage() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-semibold">Sites</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Per-site details including deployment counts and status.
                </p>
            </div>
            <Suspense fallback={<LoadingSkeleton />}>
                <SitesPanel />
            </Suspense>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="bg-muted h-10 w-64 animate-pulse rounded-md" />
            <div className="bg-muted h-64 animate-pulse rounded-md" />
        </div>
    );
}

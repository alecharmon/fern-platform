import { Suspense } from "react";

import { OrganizationsPanel } from "./OrganizationsPanel";

export default function AdminOrganizationsPage() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-semibold">Organizations</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Org-level stats sorted by publish count. Click a row to expand sites.
                </p>
            </div>
            <Suspense fallback={<LoadingSkeleton />}>
                <OrganizationsPanel />
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

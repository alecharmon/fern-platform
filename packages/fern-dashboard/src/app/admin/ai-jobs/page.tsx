import { Suspense } from "react";

import { AiJobsPanel } from "./AiJobsPanel";

export default function AdminAiJobsPage() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-semibold">AI jobs</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Reindexing job status from AI Supabase. Filter by domain or status.
                </p>
            </div>
            <Suspense fallback={<LoadingSkeleton />}>
                <AiJobsPanel />
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

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex w-full flex-col gap-4">
            {/* Date Range and Refresh Button Skeleton */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-[180px]" />
                <Skeleton className="h-9 w-[100px]" />
            </div>

            {/* Metrics Cards Skeleton */}
            <div className="flex gap-4">
                <div className="border-border flex flex-1 flex-col gap-3 rounded-lg border bg-white p-6 dark:bg-transparent">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-9 w-32" />
                </div>
                <div className="border-border flex flex-1 flex-col gap-3 rounded-lg border bg-white p-6 dark:bg-transparent">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>

            {/* Chart Skeleton */}
            <div className="border-border w-full rounded-lg border">
                <div className="flex justify-between p-6 pb-4">
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                    <Skeleton className="h-9 w-[120px]" />
                </div>
                <div className="p-6 pr-0">
                    <Skeleton className="h-[300px] w-full" />
                </div>
            </div>

            {/* Analytics Tables Skeleton */}
            <div className="flex flex-col gap-4">
                {/* First row: Paths and Countries */}
                <div className="flex flex-col gap-4 lg:flex-row">
                    <TableSkeleton title="Paths" />
                    <TableSkeleton title="Countries" />
                </div>

                {/* Second row: Channels and Device Types */}
                <div className="flex flex-col gap-4 lg:flex-row">
                    <TableSkeleton title="Channels" />
                    <TableSkeleton title="Device Types" />
                </div>

                {/* Third row: Referring Domains and LLM File Views */}
                <div className="flex flex-col gap-4 lg:flex-row">
                    <TableSkeleton title="Referring Domains" />
                    <TableSkeleton title="LLM File Views" />
                </div>

                {/* Fourth row: 404 Pages */}
                <div className="flex flex-col gap-4 lg:flex-row">
                    <TableSkeleton title="404 Pages" fullWidth />
                </div>

                {/* Fifth row: API Explorer Requests and LLM Bot Traffic */}
                <div className="flex flex-col gap-4 lg:flex-row">
                    <TableSkeleton title="API Explorer Requests" />
                    <TableSkeleton title="LLM Bot Traffic" />
                </div>
            </div>
        </div>
    );
}

function TableSkeleton({ title, fullWidth = false }: { title: string; fullWidth?: boolean }) {
    return (
        <div
            className={`border-border flex flex-col rounded-lg border bg-white dark:bg-transparent ${fullWidth ? "w-full" : "flex-1"}`}
        >
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <Skeleton className="h-5 w-32">{title}</Skeleton>
            </div>
            <div className="flex flex-col">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className="border-border flex items-center justify-between border-b px-4 py-3 last:border-b-0"
                    >
                        <Skeleton className="h-4 w-40" />
                        <div className="flex gap-8">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

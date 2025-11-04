import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex w-full flex-col gap-4">
            {/* Date Range and Refresh Button Skeleton */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-[180px]" />
                <Skeleton className="h-9 w-[100px]" />
            </div>

            {/* Total Searches Metric Card Skeleton */}
            <div className="flex gap-4">
                <div className="border-border flex flex-1 flex-col gap-3 rounded-lg border bg-white p-6 dark:bg-transparent">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>

            {/* Analytics Tables Skeleton */}
            <div className="flex flex-col gap-4">
                {/* Top Searches and Searches with No Results */}
                <div className="flex flex-col gap-4 lg:flex-row">
                    <SearchTableSkeleton title="Top searches" />
                    <SearchTableSkeleton title="Searches with no results" />
                </div>
            </div>
        </div>
    );
}

function SearchTableSkeleton({ title }: { title: string }) {
    return (
        <div className="border-border flex flex-1 flex-col rounded-lg border bg-white dark:bg-transparent">
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <Skeleton className="h-5 w-32">{title}</Skeleton>
            </div>
            <div className="flex flex-col">
                {[...Array(10)].map((_, i) => (
                    <div
                        key={i}
                        className="border-border flex items-center justify-between border-b px-4 py-3 last:border-b-0"
                    >
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                ))}
            </div>
        </div>
    );
}

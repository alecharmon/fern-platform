import { Skeleton } from "../ui/skeleton";

/**
 * Skeleton placeholder for DocsSiteOverviewCardContent.
 * Displays loading states for the Domains section, Source, and Fern CLI Version.
 */
export function SkeletonDocsSiteOverviewCardContent() {
    return (
        <div className="flex min-w-0 flex-col gap-4 text-gray-900">
            <div className="flex flex-col gap-2">
                <p>Domains</p>
                <div className="flex flex-col items-start gap-1">
                    <Skeleton className="h-6 w-48" />
                </div>
                {/* CustomDomainSection skeleton */}
                <Skeleton className="h-8 w-40" />
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
                {/* GitSource skeleton */}
                <div className="flex min-w-0 flex-col gap-2">
                    <p>Source</p>
                    <Skeleton className="h-6 w-24" />
                </div>
                {/* FernCliVersion skeleton */}
                <div className="flex w-fit flex-col gap-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-24" />
                </div>
            </div>
        </div>
    );
}

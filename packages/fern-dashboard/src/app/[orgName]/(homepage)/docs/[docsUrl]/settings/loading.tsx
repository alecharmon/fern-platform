import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex flex-1 flex-col items-center gap-4">
            {/* Archive Site Card Skeleton */}
            <div className="border-border mx-auto mt-6 flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4 sm:mt-8 md:mt-10">
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                </div>
                <div className="mt-5 flex justify-center md:justify-end">
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>

            {/* Ask AI Card Skeleton (might be shown for Fern employees) */}
            <div className="border-border mx-auto mt-6 flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4 sm:mt-8 md:mt-10">
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-2/3" />
                </div>
                <div className="mt-5 flex justify-center md:justify-end">
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>

            {/* Delete Docs Site Card Skeleton */}
            <div className="border-border mx-auto mt-6 flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4 sm:mt-8 md:mt-10">
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-5 w-full" />
                </div>
                <div className="mt-5 flex justify-center md:justify-end">
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>
        </div>
    );
}

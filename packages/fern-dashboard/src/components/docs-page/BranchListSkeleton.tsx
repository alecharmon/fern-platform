import { Skeleton } from "../ui/skeleton";

export function BranchListSkeleton() {
    return (
        <div className="flex flex-col gap-y-3">
            <BranchListSkeletonItem showDivider />
            <BranchListSkeletonItem showDivider />
            <BranchListSkeletonItem />
        </div>
    );
}

function BranchListSkeletonItem({ showDivider = false }: { showDivider?: boolean }) {
    return (
        <>
            <div className="flex items-center justify-between gap-x-4 gap-y-1">
                <div className="flex flex-1 items-center gap-2 overflow-x-hidden">
                    <Skeleton className="size-4 shrink-0" />
                    <Skeleton className="h-6 w-48" />
                </div>
                <div className="flex items-center justify-end gap-2">
                    <Skeleton className="size-8 shrink-0" />
                    <Skeleton className="h-8 w-[84px] shrink-0" />
                </div>
            </div>
            {showDivider && <hr className="border-gray-400 dark:border-gray-600" />}
        </>
    );
}

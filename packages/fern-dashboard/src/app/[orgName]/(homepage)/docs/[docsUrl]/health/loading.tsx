import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex w-full flex-col gap-6">
            <div>
                <Skeleton className="h-7 w-32" />
                <Skeleton className="mt-2 h-5 w-96" />
            </div>

            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-9 w-28" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
                <Skeleton className="h-[200px] w-[200px] rounded-lg" />
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </div>
            </div>
        </div>
    );
}

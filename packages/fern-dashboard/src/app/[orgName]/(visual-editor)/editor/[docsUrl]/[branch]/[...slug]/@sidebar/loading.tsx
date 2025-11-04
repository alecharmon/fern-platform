import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex flex-col gap-4 py-4">
            <Skeleton className="h-9 w-[70%]" />

            <div className="flex flex-col gap-3 mt-2">
                <Skeleton className="h-4 w-[45%] font-semibold" />
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-7 w-[85%] ml-0" />
                    <Skeleton className="h-7 w-[75%] ml-0" />
                    <Skeleton className="h-7 w-[80%] ml-0" />
                    <Skeleton className="h-7 w-[70%] ml-0" />
                    <Skeleton className="h-7 w-[65%] ml-0" />
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-[40%] font-semibold" />
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-7 w-[75%] ml-0" />
                    <Skeleton className="h-7 w-[70%] ml-0" />
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-[40%] font-semibold" />
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-7 w-[75%] ml-0" />
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-[55%] font-semibold" />
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-7 w-[65%] ml-0" />
                    <Skeleton className="h-7 w-[60%] ml-0" />
                </div>
            </div>
        </div>
    );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded" />
            <Skeleton className="h-6 w-28" />
        </div>
    );
}

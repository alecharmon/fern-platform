import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
        </div>
    );
}

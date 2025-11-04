import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex w-full flex-col gap-4">
            <div className="border-border border rounded-2xl h-64 w-full p-4">
                <Skeleton className=" h-full w-full" />
            </div>
            <div className="border-border border rounded-2xl h-64 w-full p-4">
                <Skeleton className=" h-full w-full" />
            </div>
        </div>
    );
}

import Card from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex w-full flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
            </div>
            <Card className="h-[300px] max-h-[300px]">
                <Skeleton className="h-full max-h-[300px] w-full" />
            </Card>
        </div>
    );
}

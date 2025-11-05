import Card from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for the entire Visual Editor card
 * This shows while the initial GitHub URL validation happens (usually very fast)
 * Once the card loads, more granular loading states appear inside via nested Suspense
 */
export function VisualEditorLoadingCard() {
    return (
        <Card className="relative flex flex-col gap-4">
            {/* Header skeleton */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-5 w-12" />
                    </div>
                    <Skeleton className="h-5 w-64" />
                </div>
                <Skeleton className="h-9 w-32" />
            </div>

            {/* Simple content skeleton - detailed loading happens inside */}
            <div className="flex flex-col gap-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        </Card>
    );
}

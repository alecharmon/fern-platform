import Card from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function VisualEditorLoadingCard() {
    return (
        <Card className="flex flex-col">
            <Skeleton className="h-24" />
        </Card>
    );
}

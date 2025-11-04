import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <PageHeader title="Members" subtitle="Manage team members and invitations" />
            <Skeleton className="h-12 w-full" />
        </div>
    );
}

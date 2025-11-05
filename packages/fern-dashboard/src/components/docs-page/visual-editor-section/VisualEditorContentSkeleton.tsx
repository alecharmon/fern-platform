import Card from "../../ui/card";
import { BranchListSkeleton } from "../BranchListSkeleton";
import { VisualEditorHeader } from "./VisualEditorHeader";

/**
 * Skeleton for the visual editor content area while auth validation loads
 * Shows the card structure with a loading state
 */
export function VisualEditorContentSkeleton() {
    return (
        <Card className="relative flex flex-col gap-4">
            <VisualEditorHeader />
            <BranchListSkeleton />
        </Card>
    );
}

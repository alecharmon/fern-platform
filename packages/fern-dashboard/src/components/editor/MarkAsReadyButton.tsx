import { CheckIcon } from "lucide-react";
import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { useUpdatePrStatus } from "@/hooks/useUpdatePrStatus";
import { useGitPrInfo } from "@/providers/GitPRContext";
import { Button } from "../ui/button";

export const MarkAsReadyButton = () => {
    const { isReadyForReview } = useGitPrInfo();
    const { updatePrStatus, loading: updatePrStatusLoading } = useUpdatePrStatus();

    return (
        <Button
            onClick={() => void updatePrStatus("open")}
            disabled={updatePrStatusLoading || isReadyForReview}
            className="w-full"
        >
            {isReadyForReview ? (
                <>
                    Marked as ready for review
                    <CheckIcon className="size-4" />
                </>
            ) : (
                "Mark as ready for review"
            )}
        </Button>
    );
};

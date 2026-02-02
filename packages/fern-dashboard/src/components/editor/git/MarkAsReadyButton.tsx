import { CheckIcon } from "lucide-react";
import { useUpdatePrStatus } from "@/hooks/useUpdatePrStatus";
import { useGitPrStatus } from "@/providers/GitPRContext";
import { Button } from "../../ui/button";

export const MarkAsReadyButton = () => {
    const { isReadyForReview } = useGitPrStatus();
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

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { useGitPrStatus } from "@/providers/GitPRContext";

import { Button } from "../ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "../ui/dialog";

export function DeleteBranchButton({
    branch,
    onBranchDelete
}: {
    branch: string;
    onBranchDelete: (branch: string) => void;
}) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const { prStatus } = useGitPrStatus();

    const handleDeleteClick = () => {
        if (prStatus === "closed" || prStatus === "merged") {
            onBranchDelete(branch);
        } else {
            setShowDeleteDialog(true);
        }
    };

    const handleConfirmDelete = () => {
        onBranchDelete(branch);
        setShowDeleteDialog(false);
    };

    const handleCancelDelete = () => {
        setShowDeleteDialog(false);
    };

    const getDialogMessage = () => {
        if (prStatus === "open" || prStatus === "draft") {
            return "This session has committed changes. Are you sure you want to remove this session?";
        }
        return "Deleting this session will remove it and discard any unsaved changes. Proceed?";
    };

    return (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="iconSm" onClick={handleDeleteClick} className="hover:text-red-600">
                    <Trash2 className="size-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <div className="flex flex-col gap-6">
                    {" "}
                    {/* adds vertical spacing */}
                    <DialogHeader>
                        <DialogTitle>Delete Session</DialogTitle>
                        <DialogDescription>{getDialogMessage()}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancelDelete}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}

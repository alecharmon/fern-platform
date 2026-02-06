"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RenameDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentTitle: string;
    onConfirm: (newTitle: string) => void;
    entityType?: "section" | "page";
}

/** @deprecated Use RenameDialog instead */
export type RenameSectionDialogProps = RenameDialogProps;

export function RenameDialog({
    open,
    onOpenChange,
    currentTitle,
    onConfirm,
    entityType = "section"
}: RenameDialogProps) {
    const [newTitle, setNewTitle] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setNewTitle("");
        }
        onOpenChange(newOpen);
    };

    const handleOpenAutoFocus = (e: Event) => {
        e.preventDefault();
        inputRef.current?.focus();
    };

    const handleConfirm = () => {
        if (newTitle.trim()) {
            onConfirm(newTitle.trim());
            setNewTitle("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && newTitle.trim()) {
            e.preventDefault();
            handleConfirm();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent onOpenAutoFocus={handleOpenAutoFocus}>
                <DialogHeader>
                    <DialogTitle>Rename {entityType}</DialogTitle>
                </DialogHeader>

                <DialogBody className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-name" className="text-sm font-normal text-muted-foreground mb-2 block">
                            Previous {entityType} name
                        </Label>
                        <Input id="current-name" value={currentTitle} disabled className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-name" className="text-sm font-normal text-muted-foreground mb-2 block">
                            New {entityType} name
                        </Label>
                        <Input
                            ref={inputRef}
                            id="new-name"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                        />
                    </div>
                </DialogBody>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={!newTitle.trim()}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** @deprecated Use RenameDialog instead */
export const RenameSectionDialog = RenameDialog;

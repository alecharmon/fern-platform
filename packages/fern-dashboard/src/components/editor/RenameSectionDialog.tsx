"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RenameSectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentTitle: string;
    onConfirm: (newTitle: string) => void;
}

export function RenameSectionDialog({ open, onOpenChange, currentTitle, onConfirm }: RenameSectionDialogProps) {
    const [newTitle, setNewTitle] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            // Reset the new title when opening
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
                    <DialogTitle>Rename section</DialogTitle>
                </DialogHeader>

                <DialogBody className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-name" className="text-sm font-normal text-muted-foreground mb-2 block">
                            Previous section name
                        </Label>
                        <Input id="current-name" value={currentTitle} disabled className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-name" className="text-sm font-normal text-muted-foreground mb-2 block">
                            New section name
                        </Label>
                        <Input
                            ref={inputRef}
                            id="new-name"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Section"
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

"use client";

import { differenceInDays, format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { Eye, EyeOff, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";

interface PasswordProtectionSettingsCardProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
}

type CardState =
    | { status: "loading" }
    | { status: "no-password" }
    | { status: "has-password"; password: string; lastUpdatedAt: string | null; lastUpdatedBy: string | null }
    | { status: "error" };

function formatUpdatedAt(isoDate: string): { label: string; kind: "relative" | "absolute" } | null {
    const date = parseISO(isoDate);
    if (!isValid(date)) {
        return null;
    }

    const days = differenceInDays(new Date(), date);
    if (days >= 0 && days <= 14) {
        return { label: formatDistanceToNow(date, { addSuffix: true }), kind: "relative" };
    }

    return { label: format(date, "MMM d, yyyy"), kind: "absolute" };
}

export function PasswordProtectionSettingsCard({ docsUrl, orgName }: PasswordProtectionSettingsCardProps) {
    const [cardState, setCardState] = useState<CardState>({ status: "loading" });
    const [inputValue, setInputValue] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

    const fetchCurrentPassword = useCallback(async () => {
        try {
            const response = await DashboardApiClient.getPasswordProtection({ orgName, docsUrl });
            if (response.password != null) {
                setCardState({
                    status: "has-password",
                    password: response.password,
                    lastUpdatedAt: response.lastUpdatedAt,
                    lastUpdatedBy: response.lastUpdatedBy
                });
            } else {
                setCardState({ status: "no-password" });
            }
        } catch {
            setCardState({ status: "error" });
        }
    }, [orgName, docsUrl]);

    useEffect(() => {
        void fetchCurrentPassword();
    }, [fetchCurrentPassword]);

    const handleSave = async () => {
        setConfirmDialogOpen(false);
        setIsSaving(true);
        try {
            const response = await DashboardApiClient.setPasswordProtection({ orgName, docsUrl, password: inputValue });
            setCardState({
                status: "has-password",
                password: inputValue,
                lastUpdatedAt: response.lastUpdatedAt,
                lastUpdatedBy: response.lastUpdatedBy
            });
            setInputValue("");
            setIsEditing(false);
            setShowPassword(false);
            toast.success("Password protection enabled");
        } catch {
            toast.error("Failed to save password");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async () => {
        setRemoveDialogOpen(false);
        setIsRemoving(true);
        try {
            await DashboardApiClient.removePasswordProtection({ orgName, docsUrl });
            setCardState({ status: "no-password" });
            setInputValue("");
            setIsEditing(false);
            setShowPassword(false);
            toast.success("Password protection removed");
        } catch {
            toast.error("Failed to remove password protection");
        } finally {
            setIsRemoving(false);
        }
    };

    const handleSaveClick = () => {
        if (!inputValue.trim()) {
            return;
        }
        setConfirmDialogOpen(true);
    };

    const startEditing = () => {
        setIsEditing(true);
        setInputValue("");
        setShowPassword(false);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setInputValue("");
        setShowPassword(false);
    };

    return (
        <>
            <div className="border-border mx-auto flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4">
                <div className="flex flex-col gap-1">
                    <div className="font-bold">Password</div>
                    <div className="text-muted-foreground">
                        {cardState.status === "has-password"
                            ? "Your site is currently password protected."
                            : "Protect your published site with a password."}
                    </div>
                </div>
                <div className="mt-4">
                    {cardState.status === "loading" && (
                        <div className="flex flex-col gap-3">
                            <Skeleton className="h-9 w-full" />
                            <div className="flex justify-end">
                                <Skeleton className="h-9 w-20" />
                            </div>
                        </div>
                    )}

                    {cardState.status === "error" && (
                        <div className="text-sm text-destructive">
                            Failed to load password configuration.{" "}
                            <button
                                className="underline underline-offset-2 cursor-pointer"
                                onClick={() => {
                                    setCardState({ status: "loading" });
                                    void fetchCurrentPassword();
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {cardState.status === "no-password" && (
                        <div className="flex flex-col gap-3">
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Add a password"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleSaveClick();
                                        }
                                    }}
                                    className="pr-9"
                                />
                                {inputValue.length > 0 && (
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                        onClick={() => setShowPassword((v) => !v)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSaveClick}
                                    disabled={!inputValue.trim() || isSaving}
                                    className="w-20 gap-2"
                                >
                                    {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                                    Save
                                </Button>
                            </div>
                        </div>
                    )}

                    {cardState.status === "has-password" && !isEditing && (
                        <div className="flex flex-col gap-3">
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={cardState.password}
                                    readOnly
                                    className="bg-gray-200 pr-9"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                    onClick={() => setShowPassword((v) => !v)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                            {cardState.lastUpdatedAt ? (
                                <div className="text-sm text-muted-foreground">
                                    {(() => {
                                        const formatted = formatUpdatedAt(cardState.lastUpdatedAt);
                                        if (!formatted) {
                                            return null;
                                        }
                                        return (
                                            <>
                                                Last updated {formatted.label}
                                                {cardState.lastUpdatedBy ? ` by ${cardState.lastUpdatedBy}` : ""}.
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : null}
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground cursor-pointer"
                                    onClick={startEditing}
                                    disabled={isRemoving}
                                >
                                    Reset
                                </button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setRemoveDialogOpen(true)}
                                    disabled={isRemoving}
                                    className="w-24 gap-2"
                                >
                                    {isRemoving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                                    Remove
                                </Button>
                            </div>
                        </div>
                    )}

                    {cardState.status === "has-password" && isEditing && (
                        <div className="flex flex-col gap-3">
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter new password"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleSaveClick();
                                        }
                                    }}
                                    autoFocus
                                    className="pr-9"
                                />
                                {inputValue.length > 0 && (
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                        onClick={() => setShowPassword((v) => !v)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground cursor-pointer"
                                    onClick={cancelEditing}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </button>
                                <Button
                                    onClick={handleSaveClick}
                                    disabled={!inputValue.trim() || isSaving}
                                    className="w-20 gap-2"
                                >
                                    {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                                    Save
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation dialog for enabling/updating password */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {cardState.status === "has-password" ? "Update password?" : "Enable password protection?"}
                        </DialogTitle>
                        <DialogDescription className="pb-4">
                            {cardState.status === "has-password"
                                ? "Existing visitors will need to re-enter the new password."
                                : "Visitors must enter a password. Search engines will not index this site."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>
                            {cardState.status === "has-password" ? "Update" : "Enable"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation dialog for removing password */}
            <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove password protection?</DialogTitle>
                        <DialogDescription className="pb-4">
                            Are you sure you want to remove password protection? Your site will become publicly
                            accessible.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleRemove} disabled={isRemoving} className="gap-2">
                            {isRemoving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                            Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

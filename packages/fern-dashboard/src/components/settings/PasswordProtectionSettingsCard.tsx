"use client";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ExternalLinkIcon, Eye, EyeOff, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useEntitlement } from "@/state/useEntitlement";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Skeleton } from "../ui/skeleton";
import { useUpsell } from "../upsells";

interface RoleMapping {
    password: string;
    role: string;
}

dayjs.extend(relativeTime);

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
    const date = dayjs(isoDate);
    if (!date.isValid()) {
        return null;
    }

    const days = dayjs().diff(date, "day");
    if (days >= 0 && days <= 14) {
        return { label: date.fromNow(), kind: "relative" };
    }

    return { label: date.format("MMM D, YYYY"), kind: "absolute" };
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
    const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
    const [roleMappings, setRoleMappings] = useState<RoleMapping[]>([{ password: "", role: "" }]);
    const [savedRoles, setSavedRoles] = useState<RoleMapping[]>([]);
    const [visibleRolePasswords, setVisibleRolePasswords] = useState<Set<number>>(new Set());
    const [visibleModalPasswords, setVisibleModalPasswords] = useState<Set<number>>(new Set());
    const { isEntitled } = useEntitlement("password_protection");
    const { openUpsell } = useUpsell();

    const fetchCurrentPassword = useCallback(async () => {
        try {
            const response = await DashboardApiClient.getPasswordProtection({ orgName, docsUrl });
            if (response.passwords && response.passwords.length > 0) {
                const roles = response.passwords.map((p) => ({
                    password: p.password,
                    role: p.roles.join(", ")
                }));
                setSavedRoles(roles);
                setRoleMappings(roles.map((r) => ({ ...r })));
                setCardState({
                    status: "has-password",
                    password: "",
                    lastUpdatedAt: response.lastUpdatedAt,
                    lastUpdatedBy: response.lastUpdatedBy
                });
            } else if (response.password != null) {
                setCardState({
                    status: "has-password",
                    password: response.password,
                    lastUpdatedAt: response.lastUpdatedAt,
                    lastUpdatedBy: response.lastUpdatedBy
                });
            } else {
                setCardState({ status: "no-password" });
            }
        } catch (error) {
            console.error("[password-protection] Failed to fetch password config:", error);
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
            const response = await DashboardApiClient.setPasswordProtection({
                orgName,
                docsUrl,
                password: inputValue
            });
            setSavedRoles([]);
            setRoleMappings([{ password: "", role: "" }]);
            setVisibleRolePasswords(new Set());
            setCardState({
                status: "has-password",
                password: inputValue,
                lastUpdatedAt: response.lastUpdatedAt,
                lastUpdatedBy: response.lastUpdatedBy
            });
            setInputValue("");
            setIsEditing(false);
            setShowPassword(false);
            toast.success("Locking down your site. This will take up to 30 minutes to complete.");
        } catch (error) {
            console.error("[password-protection] Failed to save password:", error);
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
            setSavedRoles([]);
            setRoleMappings([{ password: "", role: "" }]);
            setVisibleRolePasswords(new Set());
            toast.success("Password protection removed. This will take up to 30 minutes to complete.");
        } catch (error) {
            console.error("[password-protection] Failed to remove password protection:", error);
            toast.error("Failed to remove password protection");
        } finally {
            setIsRemoving(false);
        }
    };

    const handleSaveClick = () => {
        if (!isEntitled) {
            openUpsell("password_protection");
            return;
        }
        if (!inputValue.trim()) {
            return;
        }
        setConfirmDialogOpen(true);
    };

    const startEditing = () => {
        if (!isEntitled) {
            openUpsell("password_protection");
            return;
        }
        setIsEditing(true);
        setInputValue("");
        setShowPassword(false);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setInputValue("");
        setShowPassword(false);
    };

    const addRoleMapping = () => {
        setRoleMappings((prev) => [...prev, { password: "", role: "" }]);
    };

    const removeRoleMapping = (index: number) => {
        setRoleMappings((prev) => prev.filter((_, i) => i !== index));
    };

    const updateRoleMapping = (index: number, field: keyof RoleMapping, value: string) => {
        setRoleMappings((prev) => prev.map((mapping, i) => (i === index ? { ...mapping, [field]: value } : mapping)));
    };

    const handleRolesDialogOpen = () => {
        if (!isEntitled) {
            openUpsell("password_protection");
            return;
        }
        if (savedRoles.length > 0) {
            setRoleMappings(savedRoles.map((r) => ({ ...r })));
        } else {
            setRoleMappings([{ password: "", role: "" }]);
        }
        setVisibleModalPasswords(new Set());
        setRolesDialogOpen(true);
    };

    const toggleModalPasswordVisibility = (index: number) => {
        setVisibleModalPasswords((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const [isSavingRoles, setIsSavingRoles] = useState(false);

    const handleSaveRoles = async () => {
        const validRoles = roleMappings.filter((m) => m.password.trim() && m.role.trim());
        if (validRoles.length === 0) {
            toast.error("Please add at least one password-role mapping");
            return;
        }
        setIsSavingRoles(true);
        try {
            const passwords = validRoles.map((r) => ({
                password: r.password,
                roles: r.role.split(",").map((s) => s.trim())
            }));
            const response = await DashboardApiClient.setPasswordProtection({
                orgName,
                docsUrl,
                passwords
            });
            setSavedRoles(validRoles);
            setVisibleRolePasswords(new Set());
            setCardState({
                status: "has-password",
                password: "",
                lastUpdatedAt: response.lastUpdatedAt,
                lastUpdatedBy: response.lastUpdatedBy
            });
            toast.success("Roles saved. Locking down your site. This will take up to 30 minutes to complete.");
            setRolesDialogOpen(false);
        } catch (error) {
            console.error("[password-protection] Failed to save roles:", error);
            toast.error("Failed to save roles");
        } finally {
            setIsSavingRoles(false);
        }
    };

    const toggleRolePasswordVisibility = (index: number) => {
        setVisibleRolePasswords((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const handleClearRoles = async () => {
        setSavedRoles([]);
        setRoleMappings([{ password: "", role: "" }]);
        setVisibleRolePasswords(new Set());
        try {
            await DashboardApiClient.removePasswordProtection({ orgName, docsUrl });
            setCardState({ status: "no-password" });
            toast.success("Roles cleared. This will take up to 30 minutes to complete.");
        } catch (error) {
            console.error("[password-protection] Failed to clear roles:", error);
            toast.error("Failed to clear roles");
        }
    };

    const hasRoles = savedRoles.length > 0;

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

                    {cardState.status === "no-password" && !hasRoles && (
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
                            <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" onClick={handleRolesDialogOpen}>
                                    Add roles
                                </Button>
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

                    {cardState.status === "no-password" && hasRoles && (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                {savedRoles.map((role, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <div className="text-sm text-muted-foreground whitespace-nowrap">Role:</div>
                                        <div className="text-sm font-medium text-foreground w-28 truncate">
                                            {role.role}
                                        </div>
                                        <div className="relative flex-1">
                                            <Input
                                                type={visibleRolePasswords.has(index) ? "text" : "password"}
                                                value={role.password}
                                                readOnly
                                                className="bg-gray-200 pr-9"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                                onClick={() => toggleRolePasswordVisibility(index)}
                                                tabIndex={-1}
                                            >
                                                {visibleRolePasswords.has(index) ? (
                                                    <EyeOff className="size-4" />
                                                ) : (
                                                    <Eye className="size-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground cursor-pointer"
                                    onClick={handleClearRoles}
                                >
                                    Clear roles
                                </button>
                                <Button variant="outline" onClick={handleRolesDialogOpen}>
                                    Edit roles
                                </Button>
                            </div>
                        </div>
                    )}

                    {cardState.status === "has-password" && !isEditing && !hasRoles && (
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
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={handleRolesDialogOpen}>
                                        Add roles
                                    </Button>
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
                        </div>
                    )}

                    {cardState.status === "has-password" && !isEditing && hasRoles && (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                {savedRoles.map((role, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <div className="text-sm text-muted-foreground whitespace-nowrap">Role:</div>
                                        <div className="text-sm font-medium text-foreground w-28 truncate">
                                            {role.role}
                                        </div>
                                        <div className="relative flex-1">
                                            <Input
                                                type={visibleRolePasswords.has(index) ? "text" : "password"}
                                                value={role.password}
                                                readOnly
                                                className="bg-gray-200 pr-9"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                                onClick={() => toggleRolePasswordVisibility(index)}
                                                tabIndex={-1}
                                            >
                                                {visibleRolePasswords.has(index) ? (
                                                    <EyeOff className="size-4" />
                                                ) : (
                                                    <Eye className="size-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
                                    onClick={handleRolesDialogOpen}
                                    disabled={isRemoving}
                                >
                                    Edit roles
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
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={handleRolesDialogOpen}>
                                        Add roles
                                    </Button>
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

            {/* RBAC roles dialog */}
            <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add roles</DialogTitle>
                        <DialogDescription>
                            Visitors who enter a specific password will be assigned the corresponding role. You can
                            define up to 3 roles.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-5 px-6 py-4">
                        {cardState.status === "has-password" &&
                            cardState.password !== "" &&
                            savedRoles.length === 0 && (
                                <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                                    Saving roles will replace your existing site password.
                                </div>
                            )}
                        <a
                            href="https://buildwithfern.com/learn/docs/authentication/features/rbac"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground w-fit"
                        >
                            Learn about Fern&apos;s RBAC here
                            <ExternalLinkIcon className="size-3.5" />
                        </a>
                        <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-[1fr_1fr_32px] gap-3 items-center">
                                <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                                    Role
                                </Label>
                                <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                                    Password
                                </Label>
                                <span />
                            </div>
                            {roleMappings.map((mapping, index) => (
                                <div key={index} className="grid grid-cols-[1fr_1fr_32px] gap-3 items-center">
                                    <Input
                                        type="text"
                                        placeholder={index === 0 ? "admin" : "Enter role"}
                                        value={mapping.role}
                                        onChange={(e) => updateRoleMapping(index, "role", e.target.value)}
                                    />
                                    <div className="relative">
                                        <Input
                                            type={visibleModalPasswords.has(index) ? "text" : "password"}
                                            placeholder={index === 0 ? "adminpass123" : "Enter password"}
                                            value={mapping.password}
                                            onChange={(e) => updateRoleMapping(index, "password", e.target.value)}
                                            className="pr-9"
                                        />
                                        {mapping.password.length > 0 && (
                                            <button
                                                type="button"
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                                onClick={() => toggleModalPasswordVisibility(index)}
                                                tabIndex={-1}
                                            >
                                                {visibleModalPasswords.has(index) ? (
                                                    <EyeOff className="size-4" />
                                                ) : (
                                                    <Eye className="size-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-center">
                                        {roleMappings.length > 1 ? (
                                            <button
                                                type="button"
                                                className="text-muted-foreground hover:text-destructive cursor-pointer rounded p-1.5 hover:bg-muted transition-colors"
                                                onClick={() => removeRoleMapping(index)}
                                            >
                                                <Trash2Icon className="size-4" />
                                            </button>
                                        ) : (
                                            <span />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer w-fit rounded-md px-2 py-1.5 -ml-2 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                            onClick={addRoleMapping}
                            disabled={roleMappings.length >= 3}
                        >
                            <PlusIcon className="size-4" />
                            Add another
                        </button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRolesDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveRoles}
                            disabled={isSavingRoles || roleMappings.every((m) => !m.password.trim() || !m.role.trim())}
                            className="gap-2"
                        >
                            {isSavingRoles ? <Loader2Icon className="size-4 animate-spin" /> : null}
                            Save roles
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

"use client";

import { GitPullRequest, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { Input } from "@/components/ui/input";
import { TeleprompterTextOnHover } from "@/components/ui/TeleprompterTextOnHover";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useGitPrInfo } from "@/providers/GitPRContext";
import { cn } from "@/utils/utils";

import { ErrorUpdatePrTitleToast } from "./EditorToasts";

interface PRTitleEditorProps {
    owner: string | undefined;
    repo: string | undefined;
    branch: string | null;
    gitPrUrl: string | undefined;
    baseBranch?: string;
    className?: string;
    hideIcon?: boolean;
}

export function PRTitleEditor({
    owner,
    repo,
    branch,
    gitPrUrl,
    baseBranch,
    className,
    hideIcon = false
}: PRTitleEditorProps) {
    const { prTitle: serverTitle, setPrTitle, loading, site } = useGitPrInfo();
    const isEditingDisabled = useEditingDisabled();
    const orgName = useOrgName();
    const [localTitle, setLocalTitle] = useState<string>(serverTitle ?? "");
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = useCallback(
        async (newTitle: string) => {
            if (isEditingDisabled) {
                return;
            }
            const trimmedTitle = newTitle.trim();

            // If the local title is the same as the server title, don't update it
            if (trimmedTitle === serverTitle?.trim()) {
                return;
            }

            setLocalTitle(trimmedTitle);
            setIsEditing(false);

            // If no PR exists yet, just save to parent state
            if (!gitPrUrl || !owner || !repo || !branch) {
                setPrTitle(trimmedTitle);
                return;
            }

            setIsSaving(true);

            try {
                const data = await DashboardApiClient.updatePrTitle({
                    orgName,
                    owner,
                    repo,
                    site,
                    branch,
                    title: trimmedTitle,
                    baseBranch
                });

                if (data.success) {
                    setPrTitle(data.title || trimmedTitle);
                } else {
                    ErrorUpdatePrTitleToast();
                }
            } catch (err) {
                ErrorUpdatePrTitleToast();
                console.error("Error updating PR title:", err);
            } finally {
                setIsSaving(false);
            }
        },
        [owner, repo, branch, site, serverTitle, gitPrUrl, setPrTitle, baseBranch, isEditingDisabled, orgName]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                void handleSave(e.currentTarget.value);
            } else if (e.key === "Escape") {
                e.preventDefault();
                setIsEditing(false);
                e.currentTarget.value = localTitle;
            }
        },
        [handleSave, localTitle]
    );

    const handleBlur = useCallback(
        (e: React.FocusEvent<HTMLInputElement>) => {
            setIsEditing(false);
            void handleSave(e.currentTarget.value);
        },
        [handleSave]
    );

    return (
        <div className={cn("flex w-fit items-center", className)}>
            {loading ? (
                <div className="flex items-center gap-1.5">
                    {!hideIcon && <GitPullRequest className="text-muted-foreground size-4" />}
                    <p className="px-2 text-gray-600">Loading title...</p>
                </div>
            ) : !isEditingDisabled && isEditing ? (
                <div className="flex items-center gap-1.5">
                    {!hideIcon && <GitPullRequest className="text-muted-foreground size-4" />}
                    <Input
                        autoFocus
                        disabled={isSaving}
                        defaultValue={localTitle || serverTitle}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        className="text-muted-foreground min-w-none mr-2 h-8 max-w-[400px] flex-1"
                        placeholder="Enter PR title..."
                    />
                </div>
            ) : (
                <div className="group max-w-[400px] flex-1 overflow-hidden rounded-md">
                    <button
                        onClick={() => !isEditingDisabled && setIsEditing(true)}
                        className="text-muted-foreground w-full p-1 px-2 text-left transition-colors hover:bg-gray-300 hover:transition-none disabled:cursor-default"
                        disabled={isSaving || isEditingDisabled}
                    >
                        <div className="flex items-center gap-1.5">
                            {!hideIcon && <GitPullRequest className="text-muted-foreground size-4" />}
                            <TeleprompterTextOnHover containerClassName="flex-1">
                                {localTitle || serverTitle || "Click to edit PR title"}
                            </TeleprompterTextOnHover>
                            {isSaving && <Loader2 className="ml-2 size-4 flex-shrink-0 animate-spin" />}
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}

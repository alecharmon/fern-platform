"use client";

import { ChevronDownIcon } from "lucide-react";
import type { GithubPrStatus } from "@/app/services/github/types";
import { useUpdatePrStatus } from "@/hooks/useUpdatePrStatus";
import { useGitPrInfo } from "@/providers/GitPRContext";

import { StatusBadge } from "../ui/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";

interface PRStatusDropdownProps {
    owner: string | undefined;
    repo: string | undefined;
    branch: string | null;
    gitPrUrl: string | undefined;
    baseBranch?: string;
}

export function PRStatusDropdown({ gitPrUrl }: PRStatusDropdownProps) {
    const { prStatus, loading } = useGitPrInfo();
    const { updatePrStatus, loading: updatePrStatusLoading } = useUpdatePrStatus();

    // If the PR does not yet exist, we'll pretend it's a draft
    if (!loading && !gitPrUrl) {
        return <StatusBadge status="draft" />;
    }

    // Show badge for merged and closed PRs, dropdown for others
    if (prStatus === "merged") {
        return <StatusBadge status="merged" />;
    } else if (prStatus === "closed") {
        return <StatusBadge status="closed" />;
    }

    const isDisabled = loading || updatePrStatusLoading || !gitPrUrl;

    return (
        <Select
            value={prStatus}
            onValueChange={(value) => void updatePrStatus(value as GithubPrStatus)}
            disabled={isDisabled}
        >
            <SelectTrigger className="border-none px-0 shadow-none focus-visible:ring-0" asChild>
                <StatusBadge
                    status={prStatus || "loading"}
                    afterSlot={!loading && <ChevronDownIcon className="size-4 text-inherit" />}
                />
            </SelectTrigger>
            <SelectContent className="space-y-2 border-gray-500 px-0" checkOnLeft>
                <SelectItem value="draft">
                    <StatusBadge status="draft" />
                </SelectItem>
                <SelectItem value="open">
                    <StatusBadge status="open" />
                </SelectItem>
            </SelectContent>
        </Select>
    );
}

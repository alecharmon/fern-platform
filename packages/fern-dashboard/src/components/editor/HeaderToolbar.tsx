"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";

import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from "@heroicons/react/24/outline";
import { ArrowLeftIcon } from "lucide-react";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useBranch } from "@/providers/BranchContext";
import { useEditor } from "@/providers/EditorContext";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import { useGitPrInfo } from "@/providers/GitPRContext";
import { DocsUrl } from "@/utils/types";

import { ProfileImage } from "../layout/ProfileImage";
import { Button } from "../ui/button";
import { ClickablePrNumber } from "./ClickablePrNumber";
import { CommitButton } from "./CommitButton";
import { DashboardTooltip } from "./DashboardTooltip";
import { DevModeSwitcher } from "./DevModeSwitcher";
import { PRStatusDropdown } from "./PRStatusDropdown";
import { PRTitleEditor } from "./PRTitleEditor";

export function HeaderToolbar({
  session,
  docsUrl,
}: {
  session: Auth0SessionData;
  docsUrl: DocsUrl;
}) {
  const { name, picture } = session.user;
  const { gitPrUrl, setPrUrl } = useGitPrInfo();
  const { branch } = useBranch();
  const { editor } = useEditor();
  const isEditingDisabled = useEditingDisabled();
  const { owner, repo, baseBranch } = useGitHubRepo();
  const orgName = useOrgName();

  useEffect(() => {
    // NOTE: This is a temporary solution to persist the PR URL across route changes/refreshes.
    const prUrl = localStorage.getItem(`gitPrUrl-${branch}`);
    if (prUrl) {
      setPrUrl(prUrl);
    }
  }, [branch, setPrUrl]);

  // Undo/redo handlers
  const handleUndo = useCallback(() => {
    if (editor?.can().undo()) {
      editor.chain().focus().undo().run();
    }
  }, [editor]);

  const handleRedo = useCallback(() => {
    if (editor?.can().redo()) {
      editor.chain().focus().redo().run();
    }
  }, [editor]);

  // Check if undo/redo is available
  const canUndo = (editor?.can().undo() ?? false) && !isEditingDisabled;
  const canRedo = (editor?.can().redo() ?? false) && !isEditingDisabled;

  return (
    <div className="bg-background flex h-[var(--header-toolbar-height-mobile)] flex-wrap items-center justify-center gap-2 border-b border-gray-500 px-2 py-2 shadow-sm md:h-[var(--header-toolbar-height)] md:py-1">
      <div className="flex w-full flex-1 items-center gap-1 text-left md:w-auto">
        <Button className="px-2" variant="ghost" size="iconSm" asChild>
          <Link href={`/${orgName}/docs/${encodeURIComponent(docsUrl)}`}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <PRTitleEditor
          owner={owner}
          repo={repo}
          baseBranch={baseBranch}
          branch={branch}
          gitPrUrl={gitPrUrl}
        />
        <ClickablePrNumber />
        <PRStatusDropdown
          owner={owner}
          repo={repo}
          baseBranch={baseBranch}
          branch={branch}
          gitPrUrl={gitPrUrl}
        />
      </div>
      <div className="flex items-center gap-2">
        <DashboardTooltip
          content={isEditingDisabled ? undefined : `Editing as ${name}`}
        >
          <ProfileImage
            picture={picture}
            name={name}
            className="ring-primary border-3 size-[34px] border-white ring-2"
          />
        </DashboardTooltip>
        <div className="bg-(--grayscale-a2) border-border overflow-hidden rounded-full border p-0.5">
          <DashboardTooltip content="Undo" delayDuration={200}>
            <Button
              variant="ghost"
              className="rounded-full"
              size="iconSm"
              disabled={!canUndo}
              onClick={handleUndo}
            >
              <ArrowUturnLeftIcon />
            </Button>
          </DashboardTooltip>
          <DashboardTooltip content="Redo" delayDuration={200}>
            <Button
              variant="ghost"
              className="rounded-full"
              size="iconSm"
              disabled={!canRedo}
              onClick={handleRedo}
            >
              <ArrowUturnRightIcon />
            </Button>
          </DashboardTooltip>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 sm:flex-1 sm:shrink-0">
        <DashboardTooltip
          content="Enable dev mode to edit the source code"
          hideInnerSpan
        >
          <div className="pointer-events-auto mr-3 hidden items-center justify-center md:flex">
            <DevModeSwitcher />
          </div>
        </DashboardTooltip>
        <CommitButton />
      </div>
    </div>
  );
}

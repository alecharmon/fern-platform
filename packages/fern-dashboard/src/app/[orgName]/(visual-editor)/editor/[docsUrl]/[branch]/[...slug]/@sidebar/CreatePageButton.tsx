"use client";

import { FernNavigation } from "@fern-api/fdr-sdk";
import { NavigationContext, getAllSections } from "@fern-docs/components";

import { DashboardTooltip } from "@/components/editor/DashboardTooltip";
import { Icon } from "@/components/icon/Icon";
import { Button } from "@/components/ui/button";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useGitPrInfo } from "@/providers/GitPRContext";

import { CreateClientPage } from "./CreateClientPage";

interface CreatePageButtonProps {
  root: FernNavigation.SidebarRootNode | undefined;
  navigationContext?: NavigationContext;
}

export function CreatePageButton({
  root,
  navigationContext,
}: CreatePageButtonProps) {
  const { prStatus } = useGitPrInfo();
  const isEditingDisabled = useEditingDisabled();

  // Check if there are sections available for creating pages
  const hasNoSections =
    !root?.children || getAllSections(root.children, [], root.id).length === 0;

  return (
    !hasNoSections && (
      <DashboardTooltip
        content={
          isEditingDisabled && prStatus === "merged"
            ? "Cannot create page - PR has already been merged"
            : isEditingDisabled && prStatus === "closed"
              ? "Cannot create page - PR has been closed"
              : undefined
        }
      >
        <CreateClientPage
          root={root}
          disabled={isEditingDisabled}
          navigationContext={navigationContext}
        >
          <Button
            className="mb-2 flex w-full items-center justify-center gap-2 self-stretch rounded-lg border border-dashed border-[var(--grayscale-a6)] p-2 text-sm text-[var(--grayscale-a11)] hover:bg-[var(--grayscale-a3)] hover:text-[var(--grayscale-a12)]"
            variant="ghost"
          >
            <Icon variant="Plus" /> Create new page
          </Button>
        </CreateClientPage>
      </DashboardTooltip>
    )
  );
}

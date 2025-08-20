"use client";

import { FernNavigation } from "@fern-api/fdr-sdk";

import { DashboardTooltip } from "@/components/editor/DashboardTooltip";
import { Icon } from "@/components/icon/Icon";
import { Button } from "@/components/ui/button";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useGitPrInfo } from "@/providers/GitPRContext";

import { CreateClientPage } from "./CreateClientPage";

interface CreatePageButtonProps {
  root: FernNavigation.SidebarRootNode | undefined;
}

export function CreatePageButton({ root }: CreatePageButtonProps) {
  const { prStatus } = useGitPrInfo();
  const isEditingDisabled = useEditingDisabled();

  return (
    <DashboardTooltip
      content={
        isEditingDisabled && (prStatus === "merged" || prStatus === "closed")
          ? "Cannot create pages when PR is closed or merged"
          : undefined
      }
    >
      <CreateClientPage root={root} disabled={isEditingDisabled}>
        <Button
          className="mb-2 flex w-full items-center justify-center gap-2 self-stretch rounded-lg border border-dashed border-[var(--grayscale-a6)] p-2 text-sm text-[var(--grayscale-a11)] hover:bg-[var(--grayscale-a3)] hover:text-[var(--grayscale-a12)]"
          variant="ghost"
        >
          <Icon variant="Plus" /> Create new page
        </Button>
      </CreateClientPage>
    </DashboardTooltip>
  );
}

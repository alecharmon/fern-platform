"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

import { ArrowRight } from "lucide-react";

import { createNavigationLocalStorage } from "@fern-docs/components";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { GithubSourceRepo } from "@/app/services/github/types";
import { Button } from "@/components/ui/button";
import Card from "@/components/ui/card";
import { ROOT_SLUG_ALIAS, constructEditorSlug } from "@/utils/editor-routing";
import { DocsUrl, EncodedDocsUrl } from "@/utils/types";

import { BranchPRInfo } from "./BranchPRInfo";
import { DeleteBranchButton } from "./DeleteBranchButton";
import { GoToEditorButton } from "./GoToEditorButton";
import { VisualEditorHeader } from "./visual-editor-section/VisualEditorHeader";

export function OpenPRsComponent({
  docsUrl,
  session,
  sourceRepo,
  branches,
  maybeCriticalUpdateWarning,
}: {
  maybeCriticalUpdateWarning: React.ReactNode;
  docsUrl: DocsUrl;
  session: Auth0SessionData;
  sourceRepo?: GithubSourceRepo;
  branches: string[];
}) {
  const orgName = useOrgName();
  const router = useRouter();

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(3);
  const [deletedBranches, setDeletedBranches] = useState<Set<string>>(
    new Set()
  );
  const BRANCHES_PER_PAGE = 3;

  const handleBranchClick = (branchName: string) => {
    const editorSlug = constructEditorSlug({
      orgName,
      docsUrl: encodeURIComponent(docsUrl) as EncodedDocsUrl,
      branchName,
      slug: ROOT_SLUG_ALIAS,
    });
    router.push(editorSlug);
  };

  const handleBranchDelete = (branchName: string) => {
    createNavigationLocalStorage().removeStore(branchName);
    setDeletedBranches((prev) => new Set(prev).add(branchName));
    const remainingBranches = branches.filter(
      (branch) => !deletedBranches.has(branch)
    );
    if (visibleCount > remainingBranches.length) {
      setVisibleCount(remainingBranches.length);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + BRANCHES_PER_PAGE, availableBranches.length)
    );
  };

  // Filter out deleted branches and get the branches to display (first N branches)
  const availableBranches = branches.filter(
    (branch) => !deletedBranches.has(branch)
  );
  const visibleBranches = availableBranches.slice(0, visibleCount);
  const hasMoreBranches = visibleCount < availableBranches.length;

  return (
    <Card>
      <div className="flex w-full flex-col gap-4">
        {maybeCriticalUpdateWarning}
        <div className="flex items-center justify-between">
          <VisualEditorHeader />
          <GoToEditorButton
            docsUrl={docsUrl}
            session={session}
            sourceRepo={sourceRepo}
          />
        </div>

        {availableBranches.length > 0 && (
          <div className="flex flex-col gap-y-3">
            {visibleBranches.map((branch, index) => (
              <Fragment key={branch}>
                <div className="flex items-center justify-between gap-x-4 gap-y-1">
                  <div className="flex-1 overflow-x-scroll">
                    <BranchPRInfo
                      branch={branch}
                      sourceRepo={sourceRepo}
                      docsUrl={docsUrl}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <DeleteBranchButton
                      branch={branch}
                      onBranchDelete={handleBranchDelete}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBranchClick(branch)}
                      className="text-green-1100 hover:text-green-1100"
                    >
                      Open
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
                {index < visibleBranches.length - 1 && (
                  <hr className="bg-gray-400 dark:bg-gray-600" />
                )}
              </Fragment>
            ))}

            {hasMoreBranches && (
              <div className="-mb-2 -ml-1">
                <Button variant="outline" size="xs" onClick={handleLoadMore}>
                  Show more
                </Button>
              </div>
            )}
          </div>
        )}

        {availableBranches.length === 0 && (
          <div className="py-8 text-center">
            <p className="dark:text-gray-1200 text-gray-500">
              No open sessions found
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

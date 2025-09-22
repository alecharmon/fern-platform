import { useState } from "react";

import { ArrowRight, Loader2 } from "lucide-react";

import { GithubSourceRepo } from "@/app/services/github/types";
import { DocsUrl } from "@/utils/types";

import { Button } from "../ui/button";
import { BranchPRInfo } from "./BranchPRInfo";
import { DeleteBranchButton } from "./DeleteBranchButton";

export function BranchListItem({
  branch,
  sourceRepo,
  docsUrl,
  showDivider = false,
  handleBranchDelete,
  handleBranchClick,
}: {
  branch: string;
  docsUrl: DocsUrl;
  sourceRepo?: GithubSourceRepo;
  showDivider?: boolean;
  handleBranchDelete: (branch: string) => void;
  handleBranchClick: (branch: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <>
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
            onClick={() => {
              setLoading(true);
              handleBranchClick(branch);
            }}
            disabled={loading}
            className="text-green-1100 hover:text-green-1100"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Open
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
      {showDivider && <hr className="border-gray-400 dark:border-gray-600" />}
    </>
  );
}

import { constructEditorSlug, ROOT_SLUG_ALIAS } from "@fern-docs/components/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { memo, useMemo, useState } from "react";
import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import type { GitSourceRepo } from "@/app/services/github/types";
import type { DocsUrl, EncodedDocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { BranchPRInfo } from "./BranchPRInfo";
import { DeleteBranchButton } from "./DeleteBranchButton";

export const BranchListItem = memo(function BranchListItem({
    branch,
    sourceRepo,
    docsUrl,
    showDivider = false,
    handleBranchDelete,
    storedPrTitle
}: {
    branch: string;
    docsUrl: DocsUrl;
    sourceRepo?: GitSourceRepo;
    showDivider?: boolean;
    handleBranchDelete: (branch: string) => void;
    storedPrTitle?: string;
}) {
    const [loading, setLoading] = useState(false);
    const orgName = useOrgName();

    const editorLink = useMemo(
        () =>
            constructEditorSlug({
                orgName,
                docsUrl: encodeURIComponent(docsUrl) as EncodedDocsUrl,
                branchName: branch,
                slug: ROOT_SLUG_ALIAS
            }),
        [orgName, docsUrl, branch]
    );
    return (
        <>
            <div className="flex items-center justify-between gap-x-4 gap-y-1">
                <div className="flex-1 overflow-x-hidden">
                    <BranchPRInfo
                        branch={branch}
                        sourceRepo={sourceRepo}
                        docsUrl={docsUrl}
                        storedPrTitle={storedPrTitle}
                    />
                </div>
                <div className="flex items-center justify-end gap-2">
                    <DeleteBranchButton branch={branch} onBranchDelete={handleBranchDelete} />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setLoading(true);
                        }}
                        disabled={loading}
                        className="text-green-1100 hover:text-green-1100 min-w-[84px]"
                        asChild={!loading}
                    >
                        <Link href={editorLink}>
                            {loading ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <>
                                    Open
                                    <ArrowRight className="size-4" />
                                </>
                            )}
                        </Link>
                    </Button>
                </div>
            </div>
            {showDivider && <hr className="border-gray-400 dark:border-gray-600" />}
        </>
    );
});

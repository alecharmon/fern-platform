import { useGitPrInfo } from "@/providers/GitPRContext";

import { Button } from "../ui/button";

export function ClickablePrNumber() {
    const { gitPrUrl, prNumber } = useGitPrInfo();
    if (!gitPrUrl || !prNumber) {
        return null;
    }
    return (
        <Button disabled={!gitPrUrl} variant="ghost" size="sm" asChild={!!gitPrUrl}>
            <a
                href={gitPrUrl ?? ""}
                target="_blank"
                className="text-muted-foreground -ml-2 flex items-center pl-1.5 pr-1.5"
            >
                <span className="text-[16px]">#{prNumber}</span>
            </a>
        </Button>
    );
}

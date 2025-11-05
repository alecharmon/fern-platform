import { useState } from "react";
import type { DocsUrl } from "@/utils/types";
import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { SetGithubSourcePopover } from "./SetGithubSource";

export function ConnectGithubRepoButton({
    docsUrl,
    variant = "outline",
    size = "sm"
}: {
    docsUrl: DocsUrl;
    size?: React.ComponentProps<typeof Button>["size"];
    variant?: React.ComponentProps<typeof Button>["variant"];
}) {
    const [isSaving, setIsSaving] = useState(false);
    return (
        <SetGithubSourcePopover docsUrl={docsUrl} setIsSaving={setIsSaving}>
            <Button size={size} className="w-fit" variant={variant} disabled={isSaving}>
                <GithubLogo />
                {isSaving ? "Saving..." : "Connect Repo"}
            </Button>
        </SetGithubSourcePopover>
    );
}

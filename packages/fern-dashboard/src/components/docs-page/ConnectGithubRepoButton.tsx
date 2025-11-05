import { useState } from "react";
import type { DocsUrl } from "@/utils/types";
import { cn } from "@/utils/utils";
import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { SetGithubSourcePopover } from "./SetGithubSource";

export function ConnectGithubRepoButton({
    docsUrl,
    variant = "outline",
    size = "sm",
    buttonClasses = "",
    buttonText = "Connect Repo"
}: {
    docsUrl: DocsUrl;
    size?: React.ComponentProps<typeof Button>["size"];
    variant?: React.ComponentProps<typeof Button>["variant"];
    buttonClasses?: string;
    buttonText?: string;
}) {
    const [isSaving, setIsSaving] = useState(false);
    return (
        <SetGithubSourcePopover docsUrl={docsUrl} setIsSaving={setIsSaving}>
            <Button size={size} variant={variant} disabled={isSaving} className={cn("w-fit", buttonClasses)}>
                <GithubLogo />
                {isSaving ? "Saving..." : buttonText}
            </Button>
        </SetGithubSourcePopover>
    );
}

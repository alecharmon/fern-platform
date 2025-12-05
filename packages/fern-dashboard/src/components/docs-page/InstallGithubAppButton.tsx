"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { validateGitRepoAction } from "@/app/actions/validate-git-repo";
import { useBackgroundPoller } from "@/hooks/useBackgroundPoller";
import type { DocsUrl } from "@/utils/types";
import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";

export function InstallGithubAppButton({
    orgName,
    docsUrl,
    githubUrl
}: {
    orgName: string;
    docsUrl: DocsUrl;
    githubUrl?: string;
}) {
    const [clicked, setClicked] = useState(false);

    const { startPolling } = useBackgroundPoller(async () => {
        if (githubUrl == null) {
            console.warn("[InstallGithubAppButton] No githubUrl to validate");
            return false;
        }

        const result = await validateGitRepoAction(orgName, docsUrl, githubUrl);
        return result.ok; // Return true to stop polling
    });

    return (
        <Button
            asChild
            onClick={() => {
                setClicked(true);
                startPolling();
            }}
            variant={clicked ? "secondary" : "default"}
            className={clicked ? "opacity-50" : ""}
        >
            <a href="https://github.com/apps/fern-api" target="_blank" rel="noopener noreferrer">
                <GithubLogo />
                {clicked ? (
                    <>
                        Listening...
                        <Loader2 className="animate-spin" />
                    </>
                ) : (
                    "Install GitHub App"
                )}
            </a>
        </Button>
    );
}

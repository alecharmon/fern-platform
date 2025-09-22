"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "@bprogress/next/app";
import { Loader2 } from "lucide-react";

import { validateGithubRepoAction } from "@/app/actions/validate-github-repo";

import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";

const MAX_BACKGROUND_POLLING_TIME = 30 * 60 * 1000; // 30 minutes
const POLLING_INTERVAL_BACKGROUND = 30 * 1000; // 30 seconds

export function InstallGithubAppButton({
  orgName,
  site,
  githubUrl,
}: {
  orgName: string;
  site: string;
  githubUrl?: string;
}) {
  const [clicked, setClicked] = useState(false);
  const [pageIsActive, setPageIsActive] = useState(false);
  const startedPollingAt = useRef<number | undefined>(undefined);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const cleanUp = useCallback(
    (success: boolean = false) => {
      router.refresh();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      startedPollingAt.current = undefined;
      // We don't want to clean up the clicked state on success so that we don't flash the install button again
      if (!success) {
        setClicked(false);
      }
    },
    [router]
  );

  const checkIfRepoIsValid = useCallback(async () => {
    if (githubUrl == null) {
      console.warn("[checkIfRepoIsValid] No githubUrl to validate");
      return;
    }
    const result = await validateGithubRepoAction(orgName, site, githubUrl);
    if (result.ok) {
      cleanUp(true);
    }
  }, [orgName, site, githubUrl, cleanUp]);

  const startBackgroundPoller = useCallback(() => {
    // If we don't have a github url, we can't poll
    if (githubUrl == null) {
      return;
    }
    startedPollingAt.current = Date.now();

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (startedPollingAt.current == null) {
        console.warn(
          "[startBackgroundPoller] startedPollingAt.current is null"
        );
        cleanUp();
        return;
      }

      // Poll for max of 30 minutes when app is in background
      if (Date.now() - startedPollingAt.current > MAX_BACKGROUND_POLLING_TIME) {
        console.warn(
          "[startBackgroundPoller] MAX_BACKGROUND_POLLING_TIME has been reached. Stopping poller."
        );
        cleanUp();
        return;
      }
      void checkIfRepoIsValid();
    }, POLLING_INTERVAL_BACKGROUND);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [githubUrl, checkIfRepoIsValid, cleanUp]);

  // Track page visibility and check if repo is valid when app is refocused
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isNowActive = !document.hidden;
      if (pageIsActive !== isNowActive) {
        // If the page just became visible again, we check if the repo is valid immediately
        if (isNowActive) {
          void checkIfRepoIsValid();
        }
        setPageIsActive(isNowActive);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [clicked, pageIsActive, checkIfRepoIsValid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <Button
      asChild
      onClick={() => {
        setClicked(true);
        startBackgroundPoller();
      }}
      variant={clicked ? "secondary" : "default"}
      className={clicked ? "opacity-50" : ""}
    >
      <a
        href="https://github.com/apps/fern-api"
        target="_blank"
        rel="noopener noreferrer"
      >
        <GithubLogo />
        {clicked ? (
          <>
            Listening...
            <Loader2 className="animate-spin" />
          </>
        ) : (
          "Install"
        )}
      </a>
    </Button>
  );
}

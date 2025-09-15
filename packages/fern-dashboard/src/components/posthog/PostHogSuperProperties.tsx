"use client";

import { useEffect } from "react";

import { usePostHog } from "posthog-js/react";

import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

export function PostHogSuperProperties() {
  const posthog = usePostHog();
  const orgName = useOrgNameFromPathname();

  useEffect(() => {
    if (posthog && orgName) {
      // Register organization as a super property and include it in ALL events automatically
      posthog.register({ orgName: orgName });
    }
  }, [posthog, orgName]);

  return null;
}

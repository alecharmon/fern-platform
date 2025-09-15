"use client";

import React, { useEffect } from "react";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { PostHogIdentify } from "@/components/posthog/PostHogIdentify";
import { PostHogPageView } from "@/components/posthog/PostHogPageView";
import { PostHogSuperProperties } from "@/components/posthog/PostHogSuperProperties";
import { isProduction } from "@/utils/environment";

export declare namespace PostHogProvider {
  export interface Props {
    session: Auth0SessionData | undefined;
    children: React.JSX.Element;
  }
}

export function PostHogProvider({ session, children }: PostHogProvider.Props) {
  const isPosthogTrackingEnabled =
    process.env.NEXT_PUBLIC_POSTHOG_TRACKING_ENABLED === "true";

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY == null) {
      throw new Error(
        "NEXT_PUBLIC_POSTHOG_KEY is not defined in the environment"
      );
    }

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ingest",
      capture_pageview: isProduction(),
    });

    if (!isPosthogTrackingEnabled) {
      posthog.opt_out_capturing();
    }

    posthog.setPersonPropertiesForFlags({
      email: session?.user.email,
    });
  }, [isPosthogTrackingEnabled, session?.user.email]);

  return (
    <PHProvider client={posthog}>
      {isPosthogTrackingEnabled && (
        <>
          <PostHogPageView />
          <PostHogIdentify user={session?.user} />
          <PostHogSuperProperties />
        </>
      )}
      {children}
    </PHProvider>
  );
}

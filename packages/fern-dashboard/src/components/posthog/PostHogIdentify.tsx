"use client";

import { useEffect } from "react";

import { User } from "@auth0/nextjs-auth0/types";
import { usePostHog } from "posthog-js/react";

export declare namespace PostHogIdentify {
    export interface Props {
        user: User | undefined;
    }
}

export function PostHogIdentify({ user }: PostHogIdentify.Props) {
    const posthog = usePostHog();

    useEffect(() => {
        if (user != null) {
            posthog.identify(user.sub, {
                email: user.email,
                name: user.name
            });
        }
    }, [posthog, user]);

    return null;
}

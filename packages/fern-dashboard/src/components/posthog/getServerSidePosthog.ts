import { PostHog } from "posthog-node";

let posthog: PostHog | undefined;

export function getServerSidePosthog() {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY == null) {
        throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not defined in the environment");
    }

    if (posthog == null) {
        posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY);
    }

    return posthog;
}

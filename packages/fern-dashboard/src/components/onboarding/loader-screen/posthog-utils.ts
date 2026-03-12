import posthog from "posthog-js";
import { POSTHOG_UI_HOST } from "@/app/services/posthog/types";

export interface PosthogAttribution {
    initialReferrer: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    userLocation: string | null;
    initialLandingPage: string | null;
}

/**
 * Extracts PostHog attribution properties for the Slack notification.
 */
export function extractPosthogAttribution(): PosthogAttribution {
    const result: PosthogAttribution = {
        initialReferrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        userLocation: null,
        initialLandingPage: null
    };

    try {
        result.initialReferrer = (posthog.get_property?.("$initial_referring_domain") as string | undefined) ?? null;
        result.utmSource = (posthog.get_property?.("$initial_utm_source") as string | undefined) ?? null;
        result.utmMedium = (posthog.get_property?.("$initial_utm_medium") as string | undefined) ?? null;
        result.utmCampaign = (posthog.get_property?.("$initial_utm_campaign") as string | undefined) ?? null;

        // Extract geolocation and landing page from PostHog for the notification
        const city = posthog.get_property?.("$geoip_city_name") as string | undefined;
        const country = posthog.get_property?.("$geoip_country_name") as string | undefined;
        if (city && country) {
            result.userLocation = `${city}, ${country}`;
        } else if (country) {
            result.userLocation = country;
        }

        result.initialLandingPage = (posthog.get_property?.("$initial_current_url") as string | undefined) ?? null;
    } catch (err) {
        console.error("[LoaderScreen] Failed to get PostHog attribution properties:", err);
    }

    return result;
}

/**
 * Gets the PostHog session replay URL for the FTUX session.
 */
export function getSessionReplayUrl(): string | null {
    try {
        const replayUrl = posthog.get_session_replay_url?.({ withTimestamp: true });
        if (replayUrl) {
            return replayUrl.replace(/^\/ingest/, POSTHOG_UI_HOST);
        }
    } catch (err) {
        console.error("[LoaderScreen] Failed to get PostHog session replay URL:", err);
    }
    return null;
}

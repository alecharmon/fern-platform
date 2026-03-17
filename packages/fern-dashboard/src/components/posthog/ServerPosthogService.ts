import type { PostHog as PostHogNode } from "posthog-node";
import { PosthogEventName } from "./events";
import type { PostmanSpecPublishedProperties } from "./events/PostmanSpecPublishedEvent";
import { PostmanSpecPublishedBuilder } from "./events/PostmanSpecPublishedEvent";
import type { SubscriptionActivatedProperties } from "./events/SubscriptionActivatedEvent";
import { SubscriptionActivatedBuilder } from "./events/SubscriptionActivatedEvent";
import type { TrialStartedProperties } from "./events/TrialStartedEvent";
import { TrialStartedBuilder } from "./events/TrialStartedEvent";

/**
 * Server-side PostHog service for the dashboard.
 * Uses phantom-type builders for compile-time enforcement of required fields.
 * Handles auth resolution (Auth0 userId, orgName) internally via builders
 * so callers only need to provide the minimum input for each event.
 */
export class ServerPosthogService {
    constructor(private client: PostHogNode) {}

    /**
     * Capture a postman-spec-published event.
     * Resolves Auth0 primary userId from postmanUserId and orgId/orgName from Venus + Auth0.
     */
    async capturePostmanSpecPublished(input: {
        postmanUserId: string;
        teamId: string;
        collectionId: string;
    }): Promise<void> {
        try {
            const builder = await (
                await new PostmanSpecPublishedBuilder()
                    .withTeamId(input.teamId)
                    .withCollectionId(input.collectionId)
                    .fromPostmanUser(input.postmanUserId)
            ).fromPostmanTeam(input.teamId);

            const properties: PostmanSpecPublishedProperties = builder.build();

            this.client.capture({
                distinctId: properties.userId,
                event: PosthogEventName.POSTMAN_SPEC_PUBLISHED,
                properties
            });
        } catch (e) {
            console.error("[ServerPosthogService] Failed to capture postman-spec-published event:", e);
        }
    }

    /**
     * Capture a trial-started event.
     * Resolves orgName from Auth0 given the orgId.
     */
    async captureTrialStarted(input: { orgId: string; plan?: string; subscriptionId?: string }): Promise<void> {
        try {
            const builder = await new TrialStartedBuilder()
                .withPlan(input.plan)
                .withSubscriptionId(input.subscriptionId)
                .fromOrgId(input.orgId);

            const properties: TrialStartedProperties = builder.build();

            this.client.capture({
                distinctId: properties.userId,
                event: PosthogEventName.TRIAL_STARTED,
                properties
            });
        } catch (e) {
            console.error("[ServerPosthogService] Failed to capture trial-started event:", e);
        }
    }

    /**
     * Capture a subscription-activated event.
     * Resolves orgName from Auth0 given the orgId.
     */
    async captureSubscriptionActivated(input: {
        orgId: string;
        plan?: string;
        subscriptionId?: string;
    }): Promise<void> {
        try {
            const builder = await new SubscriptionActivatedBuilder()
                .withPlan(input.plan)
                .withSubscriptionId(input.subscriptionId)
                .fromOrgId(input.orgId);

            const properties: SubscriptionActivatedProperties = builder.build();

            this.client.capture({
                distinctId: properties.userId,
                event: PosthogEventName.SUBSCRIPTION_ACTIVATED,
                properties
            });
        } catch (e) {
            console.error("[ServerPosthogService] Failed to capture subscription-activated event:", e);
        }
    }
}

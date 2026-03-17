import { getOrganizationById } from "@/app/services/auth0/management";
import { Auth0OrgID } from "@/app/services/auth0/types";
import type { BaseServerPosthogEventProperties, IsSet, Unset } from "./types";

export interface SubscriptionActivatedProperties extends BaseServerPosthogEventProperties {
    plan?: string;
    subscriptionId?: string;
}

/**
 * Phantom-type builder for subscription-activated event properties.
 * build() is only callable when UserId and OrgId are 'set'.
 * plan and subscriptionId are optional.
 */
export class SubscriptionActivatedBuilder<_UserId extends string = Unset, _OrgId extends string = Unset> {
    private _userId?: string;
    private _orgId?: string;
    private _orgName?: string;
    private _plan?: string;
    private _subscriptionId?: string;

    withUserId(userId: string): SubscriptionActivatedBuilder<IsSet, _OrgId> {
        this._userId = userId;
        return this as unknown as SubscriptionActivatedBuilder<IsSet, _OrgId>;
    }

    withOrgId(orgId: string): SubscriptionActivatedBuilder<_UserId, IsSet> {
        this._orgId = orgId;
        return this as unknown as SubscriptionActivatedBuilder<_UserId, IsSet>;
    }

    withOrgName(orgName: string | undefined): this {
        this._orgName = orgName;
        return this;
    }

    withPlan(plan: string | undefined): this {
        this._plan = plan;
        return this;
    }

    withSubscriptionId(subscriptionId: string | undefined): this {
        this._subscriptionId = subscriptionId;
        return this;
    }

    /**
     * Resolve orgName from Auth0 given an orgId.
     * Also sets userId to orgId (Stripe webhooks don't carry user identity).
     * Sets both UserId and OrgId phantom types.
     */
    async fromOrgId(orgId: string): Promise<SubscriptionActivatedBuilder<IsSet, IsSet>> {
        this._orgId = orgId;
        this._userId = orgId;
        try {
            const org = await getOrganizationById(Auth0OrgID(orgId));
            this._orgName = org.display_name ?? org.name ?? orgId;
        } catch {
            this._orgName = orgId;
        }
        return this as unknown as SubscriptionActivatedBuilder<IsSet, IsSet>;
    }

    build(this: SubscriptionActivatedBuilder<IsSet, IsSet>): SubscriptionActivatedProperties {
        return {
            userId: this._userId!,
            orgId: this._orgId!,
            orgName: this._orgName,
            plan: this._plan,
            subscriptionId: this._subscriptionId
        };
    }
}

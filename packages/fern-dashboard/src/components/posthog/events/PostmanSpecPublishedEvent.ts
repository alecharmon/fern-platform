import { getOrganizationById, resolveAuth0UserIdFromPostmanUserId } from "@/app/services/auth0/management";
import { Auth0OrgID } from "@/app/services/auth0/types";
import type { BaseServerPosthogEventProperties, IsSet, Unset } from "./types";

export interface PostmanSpecPublishedProperties extends BaseServerPosthogEventProperties {
    teamId: string;
    collectionId: string;
}

/**
 * Phantom-type builder for postman-spec-published event properties.
 * build() is only callable when all required generics are 'set'.
 */
export class PostmanSpecPublishedBuilder<
    _UserId extends string = Unset,
    _OrgId extends string = Unset,
    _TeamId extends string = Unset,
    _CollectionId extends string = Unset
> {
    private _userId?: string;
    private _orgId?: string;
    private _orgName?: string;
    private _teamId?: string;
    private _collectionId?: string;

    withUserId(userId: string): PostmanSpecPublishedBuilder<IsSet, _OrgId, _TeamId, _CollectionId> {
        this._userId = userId;
        return this as unknown as PostmanSpecPublishedBuilder<IsSet, _OrgId, _TeamId, _CollectionId>;
    }

    withOrgId(orgId: string): PostmanSpecPublishedBuilder<_UserId, IsSet, _TeamId, _CollectionId> {
        this._orgId = orgId;
        return this as unknown as PostmanSpecPublishedBuilder<_UserId, IsSet, _TeamId, _CollectionId>;
    }

    withOrgName(orgName: string | undefined): this {
        this._orgName = orgName;
        return this;
    }

    withTeamId(teamId: string): PostmanSpecPublishedBuilder<_UserId, _OrgId, IsSet, _CollectionId> {
        this._teamId = teamId;
        return this as unknown as PostmanSpecPublishedBuilder<_UserId, _OrgId, IsSet, _CollectionId>;
    }

    withCollectionId(collectionId: string): PostmanSpecPublishedBuilder<_UserId, _OrgId, _TeamId, IsSet> {
        this._collectionId = collectionId;
        return this as unknown as PostmanSpecPublishedBuilder<_UserId, _OrgId, _TeamId, IsSet>;
    }

    /**
     * Resolve userId from a Postman userId by looking up the Auth0 primary identity,
     * and resolve orgId/orgName from Venus + Auth0 given a teamId.
     * Sets UserId and OrgId phantom types.
     */
    async fromPostmanUser(
        postmanUserId: string
    ): Promise<PostmanSpecPublishedBuilder<IsSet, _OrgId, _TeamId, _CollectionId>> {
        try {
            this._userId = await resolveAuth0UserIdFromPostmanUserId(postmanUserId);
        } catch {
            this._userId = `oauth2|postman|${postmanUserId}`;
        }
        return this as unknown as PostmanSpecPublishedBuilder<IsSet, _OrgId, _TeamId, _CollectionId>;
    }

    /**
     * Resolve orgId and orgName from a Postman teamId via Venus + Auth0.
     * Sets OrgId phantom type.
     */
    async fromPostmanTeam(
        teamId: string
    ): Promise<PostmanSpecPublishedBuilder<_UserId, IsSet, _TeamId, _CollectionId>> {
        try {
            const venusServerUrl = process.env.VENUS_SERVER_URL;
            if (venusServerUrl) {
                const venusResponse = await fetch(
                    `${venusServerUrl}/organizations/postman-team/${encodeURIComponent(teamId)}/org-ids`,
                    { method: "GET" }
                );
                if (venusResponse.ok) {
                    const venusData: unknown = await venusResponse.json();
                    if (typeof venusData === "string") {
                        this._orgId = venusData;
                    } else if (Array.isArray(venusData) && typeof venusData[0] === "string") {
                        this._orgId = venusData[0];
                    }
                    if (this._orgId) {
                        try {
                            const org = await getOrganizationById(Auth0OrgID(this._orgId));
                            this._orgName = org.display_name ?? org.name ?? undefined;
                        } catch {
                            // orgName stays undefined
                        }
                    }
                }
            }
        } catch {
            // orgId/orgName stay undefined
        }

        if (this._orgId == null) {
            this._orgId = "";
        }

        return this as unknown as PostmanSpecPublishedBuilder<_UserId, IsSet, _TeamId, _CollectionId>;
    }

    build(this: PostmanSpecPublishedBuilder<IsSet, IsSet, IsSet, IsSet>): PostmanSpecPublishedProperties {
        return {
            userId: this._userId!,
            orgId: this._orgId!,
            orgName: this._orgName,
            teamId: this._teamId!,
            collectionId: this._collectionId!
        };
    }
}

import type { BaseServerPosthogEventProperties, IsSet, Unset } from "./types";

export interface UserJoinedOrgProperties extends BaseServerPosthogEventProperties {
    orgName: string;
    email?: string;
    source?: string;
}

/**
 * Phantom-type builder for user-joined-org event properties.
 * build() is only callable when UserId, OrgId, and OrgName are 'set'.
 * orgName is required (not optional) for this specific event.
 */
export class UserJoinedOrgBuilder<
    _UserId extends string = Unset,
    _OrgId extends string = Unset,
    _OrgName extends string = Unset
> {
    private _userId?: string;
    private _orgId?: string;
    private _orgName?: string;
    private _email?: string;
    private _source?: string;

    withUserId(userId: string): UserJoinedOrgBuilder<IsSet, _OrgId, _OrgName> {
        this._userId = userId;
        return this as unknown as UserJoinedOrgBuilder<IsSet, _OrgId, _OrgName>;
    }

    withOrgId(orgId: string): UserJoinedOrgBuilder<_UserId, IsSet, _OrgName> {
        this._orgId = orgId;
        return this as unknown as UserJoinedOrgBuilder<_UserId, IsSet, _OrgName>;
    }

    withOrgName(orgName: string): UserJoinedOrgBuilder<_UserId, _OrgId, IsSet> {
        this._orgName = orgName;
        return this as unknown as UserJoinedOrgBuilder<_UserId, _OrgId, IsSet>;
    }

    withEmail(email: string | undefined): this {
        this._email = email;
        return this;
    }

    withSource(source: string | undefined): this {
        this._source = source;
        return this;
    }

    build(this: UserJoinedOrgBuilder<IsSet, IsSet, IsSet>): UserJoinedOrgProperties {
        return {
            userId: this._userId!,
            orgId: this._orgId!,
            orgName: this._orgName!,
            email: this._email,
            source: this._source
        };
    }
}

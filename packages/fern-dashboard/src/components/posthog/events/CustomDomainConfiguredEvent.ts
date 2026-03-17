import type { BaseServerPosthogEventProperties, IsSet, Unset } from "./types";

export interface CustomDomainConfiguredProperties extends BaseServerPosthogEventProperties {
    domain: string;
    siteUrl: string;
}

/**
 * Phantom-type builder for custom-domain-configured event properties.
 * build() is only callable when all required generics are 'set'.
 */
export class CustomDomainConfiguredBuilder<
    _UserId extends string = Unset,
    _OrgId extends string = Unset,
    _Domain extends string = Unset,
    _SiteUrl extends string = Unset
> {
    private _userId?: string;
    private _orgId?: string;
    private _orgName?: string;
    private _domain?: string;
    private _siteUrl?: string;

    withUserId(userId: string): CustomDomainConfiguredBuilder<IsSet, _OrgId, _Domain, _SiteUrl> {
        this._userId = userId;
        return this as unknown as CustomDomainConfiguredBuilder<IsSet, _OrgId, _Domain, _SiteUrl>;
    }

    withOrgId(orgId: string): CustomDomainConfiguredBuilder<_UserId, IsSet, _Domain, _SiteUrl> {
        this._orgId = orgId;
        return this as unknown as CustomDomainConfiguredBuilder<_UserId, IsSet, _Domain, _SiteUrl>;
    }

    withOrgName(orgName: string | undefined): this {
        this._orgName = orgName;
        return this;
    }

    withDomain(domain: string): CustomDomainConfiguredBuilder<_UserId, _OrgId, IsSet, _SiteUrl> {
        this._domain = domain;
        return this as unknown as CustomDomainConfiguredBuilder<_UserId, _OrgId, IsSet, _SiteUrl>;
    }

    withSiteUrl(siteUrl: string): CustomDomainConfiguredBuilder<_UserId, _OrgId, _Domain, IsSet> {
        this._siteUrl = siteUrl;
        return this as unknown as CustomDomainConfiguredBuilder<_UserId, _OrgId, _Domain, IsSet>;
    }

    build(this: CustomDomainConfiguredBuilder<IsSet, IsSet, IsSet, IsSet>): CustomDomainConfiguredProperties {
        return {
            userId: this._userId!,
            orgId: this._orgId!,
            orgName: this._orgName,
            domain: this._domain!,
            siteUrl: this._siteUrl!
        };
    }
}

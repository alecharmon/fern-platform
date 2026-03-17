import type { BaseServerPosthogEventProperties, IsSet, Unset } from "./types";

export interface DocsSitePublishedProperties extends BaseServerPosthogEventProperties {
    siteUrl: string;
    isPreview: boolean;
}

/**
 * Phantom-type builder for docs-site-published event properties (dashboard version).
 * build() is only callable when all required generics are 'set'.
 */
export class DocsSitePublishedBuilder<
    _UserId extends string = Unset,
    _OrgId extends string = Unset,
    _SiteUrl extends string = Unset,
    _Preview extends string = Unset
> {
    private _userId?: string;
    private _orgId?: string;
    private _orgName?: string;
    private _siteUrl?: string;
    private _isPreview?: boolean;

    withUserId(userId: string): DocsSitePublishedBuilder<IsSet, _OrgId, _SiteUrl, _Preview> {
        this._userId = userId;
        return this as unknown as DocsSitePublishedBuilder<IsSet, _OrgId, _SiteUrl, _Preview>;
    }

    withOrgId(orgId: string): DocsSitePublishedBuilder<_UserId, IsSet, _SiteUrl, _Preview> {
        this._orgId = orgId;
        return this as unknown as DocsSitePublishedBuilder<_UserId, IsSet, _SiteUrl, _Preview>;
    }

    withOrgName(orgName: string | undefined): this {
        this._orgName = orgName;
        return this;
    }

    withSiteUrl(siteUrl: string): DocsSitePublishedBuilder<_UserId, _OrgId, IsSet, _Preview> {
        this._siteUrl = siteUrl;
        return this as unknown as DocsSitePublishedBuilder<_UserId, _OrgId, IsSet, _Preview>;
    }

    withIsPreview(isPreview: boolean): DocsSitePublishedBuilder<_UserId, _OrgId, _SiteUrl, IsSet> {
        this._isPreview = isPreview;
        return this as unknown as DocsSitePublishedBuilder<_UserId, _OrgId, _SiteUrl, IsSet>;
    }

    build(this: DocsSitePublishedBuilder<IsSet, IsSet, IsSet, IsSet>): DocsSitePublishedProperties {
        return {
            userId: this._userId!,
            orgId: this._orgId!,
            orgName: this._orgName,
            siteUrl: this._siteUrl!,
            isPreview: this._isPreview!
        };
    }
}

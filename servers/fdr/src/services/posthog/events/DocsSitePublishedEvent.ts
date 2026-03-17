import type { AuthService } from "../../auth/AuthService";
import type { BasePosthogEventProperties, IsSet, Unset } from "./types";

export const DOCS_SITE_PUBLISHED_EVENT = "docs-site-published";

export interface DocsSitePublishedProperties extends BasePosthogEventProperties {
    siteUrl: string;
    isPreview: boolean;
}

/**
 * Phantom-type builder for docs-site-published event properties.
 * Compile-time enforcement: build() is only callable when all required
 * generics are 'set'.
 *
 * Usage:
 *   // via auth header (async — resolves userId and orgName)
 *   const builder = await new DocsSitePublishedBuilder()
 *     .withOrgId(orgId)
 *     .withSiteUrl(url)
 *     .withIsPreview(false)
 *     .fromAuthHeader(authHeader, authService);
 *   const props = builder.build();
 *
 *   // via individual fields
 *   const props = new DocsSitePublishedBuilder()
 *     .withUserId(userId)
 *     .withOrgId(orgId)
 *     .withSiteUrl(url)
 *     .withIsPreview(false)
 *     .build();
 *
 *   // compile error — userId never set
 *   new DocsSitePublishedBuilder()
 *     .withOrgId(orgId)
 *     .withSiteUrl(url)
 *     .withIsPreview(false)
 *     .build(); // ❌
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

    /**
     * Resolve userId (and optionally orgName) from an auth header via AuthService.
     * Falls back to orgId for userId if resolution fails.
     * OrgId should be set before calling this method so orgName can also be resolved.
     */
    async fromAuthHeader(
        authHeader: string,
        authService: AuthService
    ): Promise<DocsSitePublishedBuilder<IsSet, _OrgId, _SiteUrl, _Preview>> {
        try {
            const resolvedUserId = await authService.getUserIdFromAuthHeader({ authHeader });
            if (resolvedUserId != null) {
                this._userId = resolvedUserId;
            }
        } catch {
            // Fall through — use orgId as userId
        }

        if (this._userId == null) {
            this._userId = this._orgId;
        }

        if (this._orgId != null && this._orgName == null) {
            try {
                const resolvedOrgName = await authService.getOrgDisplayNameById({
                    authHeader,
                    orgId: this._orgId
                });
                if (resolvedOrgName != null) {
                    this._orgName = resolvedOrgName;
                }
            } catch {
                // orgName stays undefined
            }
        }

        return this as unknown as DocsSitePublishedBuilder<IsSet, _OrgId, _SiteUrl, _Preview>;
    }

    /**
     * Build the final properties object.
     * Only callable when all required phantom types are 'set'.
     */
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

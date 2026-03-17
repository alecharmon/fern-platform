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
 *   // via individual fields (userId is optional)
 *   const props = new DocsSitePublishedBuilder()
 *     .withUserId(userId)
 *     .withOrgId(orgId)
 *     .withSiteUrl(url)
 *     .withIsPreview(false)
 *     .build();
 *
 *   // compile error — orgId never set
 *   new DocsSitePublishedBuilder()
 *     .withSiteUrl(url)
 *     .withIsPreview(false)
 *     .build(); // ❌
 */
export class DocsSitePublishedBuilder<
    _OrgId extends string = Unset,
    _SiteUrl extends string = Unset,
    _Preview extends string = Unset
> {
    private _userId?: string;
    private _orgId?: string;
    private _orgName?: string;
    private _siteUrl?: string;
    private _isPreview?: boolean;

    withUserId(userId: string): DocsSitePublishedBuilder<_OrgId, _SiteUrl, _Preview> {
        this._userId = userId;
        return this as unknown as DocsSitePublishedBuilder<_OrgId, _SiteUrl, _Preview>;
    }

    withOrgId(orgId: string): DocsSitePublishedBuilder<IsSet, _SiteUrl, _Preview> {
        this._orgId = orgId;
        return this as unknown as DocsSitePublishedBuilder<IsSet, _SiteUrl, _Preview>;
    }

    withOrgName(orgName: string | undefined): this {
        this._orgName = orgName;
        return this;
    }

    withSiteUrl(siteUrl: string): DocsSitePublishedBuilder<_OrgId, IsSet, _Preview> {
        this._siteUrl = siteUrl;
        return this as unknown as DocsSitePublishedBuilder<_OrgId, IsSet, _Preview>;
    }

    withIsPreview(isPreview: boolean): DocsSitePublishedBuilder<_OrgId, _SiteUrl, IsSet> {
        this._isPreview = isPreview;
        return this as unknown as DocsSitePublishedBuilder<_OrgId, _SiteUrl, IsSet>;
    }

    /**
     * Resolve userId (and optionally orgName) from an auth header via AuthService.
     * userId will be undefined if it cannot be resolved (e.g. when using an org token).
     * OrgId should be set before calling this method so orgName can also be resolved.
     */
    async fromAuthHeader(
        authHeader: string,
        authService: AuthService
    ): Promise<DocsSitePublishedBuilder<_OrgId, _SiteUrl, _Preview>> {
        try {
            const resolvedUserId = await authService.getUserIdFromAuthHeader({ authHeader });
            if (resolvedUserId != null) {
                this._userId = resolvedUserId;
            }
        } catch {
            // userId stays undefined when resolution fails
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

        return this as unknown as DocsSitePublishedBuilder<_OrgId, _SiteUrl, _Preview>;
    }

    /**
     * Build the final properties object.
     * Only callable when all required phantom types are 'set'.
     */
    build(this: DocsSitePublishedBuilder<IsSet, IsSet, IsSet>): DocsSitePublishedProperties {
        return {
            userId: this._userId,
            orgId: this._orgId!,
            orgName: this._orgName,
            siteUrl: this._siteUrl!,
            isPreview: this._isPreview!
        };
    }
}

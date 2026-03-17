import type { BaseServerPosthogEventProperties, IsSet, Unset } from "./types";

export interface EditorSessionStartedProperties extends BaseServerPosthogEventProperties {
    docsUrl: string;
}

/**
 * Phantom-type builder for editor-session-started event properties.
 * build() is only callable when all required generics are 'set'.
 */
export class EditorSessionStartedBuilder<
    _UserId extends string = Unset,
    _OrgId extends string = Unset,
    _DocsUrl extends string = Unset
> {
    private _userId?: string;
    private _orgId?: string;
    private _orgName?: string;
    private _docsUrl?: string;

    withUserId(userId: string): EditorSessionStartedBuilder<IsSet, _OrgId, _DocsUrl> {
        this._userId = userId;
        return this as unknown as EditorSessionStartedBuilder<IsSet, _OrgId, _DocsUrl>;
    }

    withOrgId(orgId: string): EditorSessionStartedBuilder<_UserId, IsSet, _DocsUrl> {
        this._orgId = orgId;
        return this as unknown as EditorSessionStartedBuilder<_UserId, IsSet, _DocsUrl>;
    }

    withOrgName(orgName: string | undefined): this {
        this._orgName = orgName;
        return this;
    }

    withDocsUrl(docsUrl: string): EditorSessionStartedBuilder<_UserId, _OrgId, IsSet> {
        this._docsUrl = docsUrl;
        return this as unknown as EditorSessionStartedBuilder<_UserId, _OrgId, IsSet>;
    }

    build(this: EditorSessionStartedBuilder<IsSet, IsSet, IsSet>): EditorSessionStartedProperties {
        return {
            userId: this._userId!,
            orgId: this._orgId!,
            orgName: this._orgName,
            docsUrl: this._docsUrl!
        };
    }
}

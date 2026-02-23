export {
    type ChangelogEntry,
    type ChangelogEntryType,
    GeneratorId,
    GeneratorLanguage,
    type GeneratorScripts,
    type GeneratorType,
    ReleaseType,
    type Script,
    type VersionRange,
    type Yank
} from "@fern-api/fdr-sdk/orpc-client";

import type {
    ChangelogEntry,
    GeneratorId,
    GeneratorLanguage,
    GeneratorScripts,
    GeneratorType,
    ReleaseType,
    VersionRange,
    Yank
} from "@fern-api/fdr-sdk/orpc-client";

export type Generator = {
    id: GeneratorId;
    displayName: string;
    generatorType: GeneratorType;
    generatorLanguage: GeneratorLanguage | undefined;
    dockerImage: string;
    scripts: GeneratorScripts | undefined;
};

export interface GetChangelogRequest {
    fromVersion: VersionRange;
    toVersion: VersionRange;
}

export interface GetChangelogResponse {
    entries: ChangelogResponse[];
}

export interface ChangelogResponse {
    version: string;
    changelogEntry: ChangelogEntry[];
}

export interface ReleaseRequest {
    version: string;
    createdAt: string | undefined;
    isYanked: Yank | undefined;
    changelogEntry: ChangelogEntry[] | undefined;
}

export interface Release extends ReleaseRequest {
    releaseType: ReleaseType;
    majorVersion: number;
}

export interface BaseGeneratorRelease {
    generatorId: GeneratorId;
    irVersion: number;
    migration: string | undefined;
    customConfigSchema: string | undefined;
    tags: string[] | undefined;
}

export interface GeneratorRelease extends Release, BaseGeneratorRelease {}

export interface GeneratorReleaseRequest extends ReleaseRequest, BaseGeneratorRelease {}

export interface ListGeneratorReleasesResponse {
    generatorReleases: GeneratorRelease[];
}

export interface GetLatestGeneratorReleaseRequest {
    generator: GeneratorId;
    cliVersion?: string;
    irVersion?: number;
    generatorMajorVersion?: number;
    releaseTypes?: ReleaseType[];
}

export interface BaseCliRelease {
    irVersion: number;
    tags: string[] | undefined;
}

export interface CliRelease extends Release, BaseCliRelease {}

export interface CliReleaseRequest extends ReleaseRequest, BaseCliRelease {}

export interface ListCliReleasesResponse {
    cliReleases: CliRelease[];
}

export interface GetLatestCliReleaseRequest {
    releaseTypes?: ReleaseType[];
    irVersion?: number;
}

export interface InvalidVersionErrorMessage {
    providedVersion: string;
}

export class InvalidVersionError extends Error {
    public readonly body: InvalidVersionErrorMessage;

    constructor(body: InvalidVersionErrorMessage) {
        super("InvalidVersionError");
        this.body = body;
        Object.setPrototypeOf(this, InvalidVersionError.prototype);
    }
}

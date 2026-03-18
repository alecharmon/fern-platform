export type CollectionId = string;
export type UserId = string;
export type TeamId = string;
export type InstallationAuthId = string;

export interface CollectionStatusPublishing {
    type: "publishing";
    startedAt: string;
}

export interface CollectionStatusPublished {
    type: "published";
    url: string;
    publishedAt: string;
}

export interface CollectionStatusFailed {
    type: "failed";
    reason: string;
}

export type GetCollectionStatusResponse =
    | CollectionStatusPublishing
    | CollectionStatusPublished
    | CollectionStatusFailed;

export interface PublishCollectionPayload {
    collectionId: CollectionId;
    userId: UserId;
    teamId: TeamId;
    teamName?: string;
    teamDomain?: string;
    workspaceId?: string;
}

export interface PublishCollectionRequest {
    payload: PublishCollectionPayload;
}

export interface PublishCollectionResponse {
    success: true;
    collectionId: CollectionId;
    userId: UserId;
    teamId: TeamId;
    message: string;
    collection: Record<string, unknown>;
}

export interface UpdateCollectionPayload {
    collectionId: CollectionId;
    userId: UserId;
    teamId: TeamId;
    teamName: string;
    teamDomain: string;
    publishedUrl: string;
    workspaceId?: string;
}

export interface UpdateCollectionRequest {
    payload: UpdateCollectionPayload;
}

export interface UpdateCollectionResponse {
    success: true;
    collectionId: CollectionId;
    userId: UserId;
    teamId: TeamId;
    message: string;
    collection: Record<string, unknown>;
    repoUpdated: boolean;
}

export interface CustomerAuthPayload {
    sharedSecret: string;
    installationAuthId: InstallationAuthId;
    teamId: TeamId;
    teamName?: string;
    teamDomain?: string;
}

export interface CustomerAuthRequest {
    eventId: string;
    eventKey: string;
    eventStatusCallbackUrl?: string;
    payload: CustomerAuthPayload;
}

export interface CheckResponse {
    ok: true;
}

export interface CollectionDoesNotExistError {
    error: "CollectionDoesNotExist";
    collectionId: CollectionId;
}

export type CollectionId = string;
export type UserId = string;
export type TeamId = string;

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

export interface PublishCollectionRequest {
    collectionId: CollectionId;
    userId: UserId;
    teamId: TeamId;
}

export interface PublishCollectionResponse {
    success: true;
    collectionId: CollectionId;
    userId: UserId;
    teamId: TeamId;
    message: string;
}

export interface CheckResponse {
    ok: true;
}

export interface CollectionDoesNotExistError {
    error: "CollectionDoesNotExist";
    collectionId: CollectionId;
}

export interface EdgeFlags {
    isWhitelabeled: boolean;
    isSeoDisabled: boolean;
    isImageZoomDisabled: boolean;
    isBatchStreamToggleDisabled: boolean;
    isAudioFileDownloadSpanSummary: boolean;
    isAudioExampleInternal: boolean;
    is404PageHidden: boolean;
    isAuthenticatedPagesDiscoverable: boolean;
    isAuthedPreview: boolean;
    isNextMdxRef: boolean;
    isCustomReactEnabled: boolean;
    isDiscriminatedUnionDropdownEnabled: boolean;
    isSearchAcrossAllBasepaths: boolean;
    isRemoteMdxRenderer: boolean;
}

export const DEFAULT_EDGE_FLAGS: EdgeFlags = {
    isWhitelabeled: false,
    isSeoDisabled: false,
    isImageZoomDisabled: false,
    isBatchStreamToggleDisabled: false,
    isAudioFileDownloadSpanSummary: false,
    isAudioExampleInternal: false,
    is404PageHidden: false,
    isAuthenticatedPagesDiscoverable: false,
    isAuthedPreview: false,
    isNextMdxRef: false,
    isCustomReactEnabled: false,
    isDiscriminatedUnionDropdownEnabled: false,
    isSearchAcrossAllBasepaths: false,
    isRemoteMdxRenderer: false
};

export const DEFAULT_LOCAL_EDGE_FLAGS: EdgeFlags = {
    ...DEFAULT_EDGE_FLAGS,
    isAuthenticatedPagesDiscoverable: true,
    isCustomReactEnabled: true,
    isRemoteMdxRenderer: false
};

export const DEFAULT_SELF_HOSTED_EDGE_FLAGS: EdgeFlags = {
    ...DEFAULT_EDGE_FLAGS,
    isWhitelabeled: true,
    isCustomReactEnabled: true
};

export interface OrgEdgeFlags {
    bypassExtendedGithubAuth: boolean;
}

export const DEFAULT_ORG_EDGE_FLAGS: OrgEdgeFlags = {
    bypassExtendedGithubAuth: false
};

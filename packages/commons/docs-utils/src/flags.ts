export interface EdgeFlags {
    isWhitelabeled: boolean;
    isSeoDisabled: boolean;
    isInlineFeedbackEnabled: boolean;
    isDarkCodeEnabled: boolean;
    isImageZoomDisabled: boolean;
    isBatchStreamToggleDisabled: boolean;
    isAudioFileDownloadSpanSummary: boolean;
    isAudioExampleInternal: boolean;
    isCohereTheme: boolean;
    is404PageHidden: boolean;
    isAuthenticatedPagesDiscoverable: boolean;
    isAuthedPreview: boolean;
    isDefaultSearchFilterOn: boolean;
    isChangelogRedirects: boolean;
    isNextMdxRef: boolean;
    isCustomReactEnabled: boolean;
}

export const DEFAULT_EDGE_FLAGS: EdgeFlags = {
    isWhitelabeled: false,
    isSeoDisabled: false,
    isInlineFeedbackEnabled: false,
    isDarkCodeEnabled: false,
    isImageZoomDisabled: false,
    isBatchStreamToggleDisabled: false,
    isAudioFileDownloadSpanSummary: false,
    isAudioExampleInternal: false,
    isCohereTheme: false,
    is404PageHidden: false,
    isAuthenticatedPagesDiscoverable: false,
    isAuthedPreview: false,
    isDefaultSearchFilterOn: false,
    isChangelogRedirects: false,
    isNextMdxRef: false,
    isCustomReactEnabled: false
};

export const DEFAULT_LOCAL_EDGE_FLAGS: EdgeFlags = {
    ...DEFAULT_EDGE_FLAGS,
    isAuthenticatedPagesDiscoverable: true,
    isCustomReactEnabled: true
};

export const DEFAULT_SELF_HOSTED_EDGE_FLAGS: EdgeFlags = {
    ...DEFAULT_EDGE_FLAGS,
    isWhitelabeled: true
};

export interface OrgEdgeFlags {
    bypassExtendedGithubAuth: boolean;
}

export const DEFAULT_ORG_EDGE_FLAGS: OrgEdgeFlags = {
    bypassExtendedGithubAuth: false
};

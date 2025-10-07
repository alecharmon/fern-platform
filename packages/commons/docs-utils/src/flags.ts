export interface EdgeFlags {
    isApiScrollingDisabled: boolean;
    isWhitelabeled: boolean;
    isSeoDisabled: boolean;
    isTocDefaultEnabled: boolean;
    isHttpSnippetsEnabled: boolean;
    isInlineFeedbackEnabled: boolean;
    isDarkCodeEnabled: boolean;
    isProxyDisabled: boolean;
    isImageZoomDisabled: boolean;
    useJavaScriptAsTypeScript: boolean;
    alwaysEnableJavaScriptFetch: boolean;
    isBatchStreamToggleDisabled: boolean;
    isAudioFileDownloadSpanSummary: boolean;
    isAudioExampleInternal: boolean;
    usesApplicationJsonInFormDataValue: boolean;
    isBinaryOctetStreamAudioPlayer: boolean;
    isCohereTheme: boolean;
    isFileForgeHackEnabled: boolean;
    is404PageHidden: boolean;
    isAuthenticatedPagesDiscoverable: boolean;
    isAuthedPreview: boolean;
    isDefaultSearchFilterOn: boolean;
    isChangelogRedirects: boolean;
    isNextMdxRef: boolean;
    isLlmsTxtDisabled: boolean;
}

export const DEFAULT_EDGE_FLAGS: EdgeFlags = {
    isApiScrollingDisabled: false,
    isWhitelabeled: false,
    isSeoDisabled: false,
    isTocDefaultEnabled: false,
    isHttpSnippetsEnabled: false,
    isInlineFeedbackEnabled: false,
    isDarkCodeEnabled: false,
    isProxyDisabled: false,
    isImageZoomDisabled: false,
    useJavaScriptAsTypeScript: false,
    alwaysEnableJavaScriptFetch: false,
    isBatchStreamToggleDisabled: false,
    isAudioFileDownloadSpanSummary: false,
    isAudioExampleInternal: false,
    usesApplicationJsonInFormDataValue: false,
    isBinaryOctetStreamAudioPlayer: false,
    isCohereTheme: false,
    isFileForgeHackEnabled: false,
    is404PageHidden: false,
    isAuthenticatedPagesDiscoverable: false,
    isAuthedPreview: false,
    isDefaultSearchFilterOn: false,
    isChangelogRedirects: false,
    isNextMdxRef: false,
    isLlmsTxtDisabled: false
};

export const DEFAULT_LOCAL_EDGE_FLAGS: EdgeFlags = {
    ...DEFAULT_EDGE_FLAGS,
    isAuthenticatedPagesDiscoverable: true
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

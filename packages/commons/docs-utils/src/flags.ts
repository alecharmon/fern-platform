export interface EdgeFlags {
  isApiPlaygroundEnabled: boolean;
  isApiScrollingDisabled: boolean;
  isWhitelabeled: boolean;
  isSeoDisabled: boolean;
  isTocDefaultEnabled: boolean;
  isSnippetTemplatesEnabled: boolean;
  isHttpSnippetsEnabled: boolean;
  isInlineFeedbackEnabled: boolean;
  isDarkCodeEnabled: boolean;
  isProxyDisabled: boolean;
  isImageZoomDisabled: boolean;
  useJavaScriptAsTypeScript: boolean;
  alwaysEnableJavaScriptFetch: boolean;
  scrollInContainerEnabled: boolean;
  isBatchStreamToggleDisabled: boolean;
  isAuthEnabledInDocs: boolean;
  isAudioFileDownloadSpanSummary: boolean;
  isDocsLogoTextEnabled: boolean;
  isAudioExampleInternal: boolean;
  usesApplicationJsonInFormDataValue: boolean;
  isBinaryOctetStreamAudioPlayer: boolean;
  isCohereTheme: boolean;
  isFileForgeHackEnabled: boolean;
  is404PageHidden: boolean;
  isNewSearchExperienceEnabled: boolean;
  isAuthenticatedPagesDiscoverable: boolean;
  isSearchV2Enabled: boolean;
  isAuthedPreview: boolean;
  isSearchDisabled: boolean;
  isDefaultSearchFilterOn: boolean;
  isChangelogRedirects: boolean;
  isPosthogDisabled: boolean;
  isNextMdxRef: boolean;
  isLlmsTxtDisabled: boolean;
  isDynamicSnippetsEnabled: boolean;
}

export const DEFAULT_EDGE_FLAGS: EdgeFlags = {
  isApiPlaygroundEnabled: false,
  isApiScrollingDisabled: false,
  isWhitelabeled: false,
  isSeoDisabled: false,
  isTocDefaultEnabled: false,
  isSnippetTemplatesEnabled: false,
  isHttpSnippetsEnabled: false,
  isInlineFeedbackEnabled: false,
  isDarkCodeEnabled: false,
  isProxyDisabled: false,
  isImageZoomDisabled: false,
  useJavaScriptAsTypeScript: false,
  alwaysEnableJavaScriptFetch: false,
  scrollInContainerEnabled: false,
  isBatchStreamToggleDisabled: false,
  isAuthEnabledInDocs: false,
  isAudioFileDownloadSpanSummary: false,
  isDocsLogoTextEnabled: false,
  isAudioExampleInternal: false,
  usesApplicationJsonInFormDataValue: false,
  isBinaryOctetStreamAudioPlayer: false,
  isCohereTheme: false,
  isFileForgeHackEnabled: false,
  is404PageHidden: false,
  isNewSearchExperienceEnabled: false,
  isAuthenticatedPagesDiscoverable: false,
  isSearchV2Enabled: false,
  isAuthedPreview: false,
  isSearchDisabled: false,
  isDefaultSearchFilterOn: false,
  isChangelogRedirects: false,
  isPosthogDisabled: false,
  isNextMdxRef: false,
  isLlmsTxtDisabled: false,
  isDynamicSnippetsEnabled: false,
};

export const DEFAULT_LOCAL_EDGE_FLAGS: EdgeFlags = {
  ...DEFAULT_EDGE_FLAGS,
  isAuthenticatedPagesDiscoverable: true,
};

export const DEFAULT_SELF_HOSTED_EDGE_FLAGS: EdgeFlags = {
  ...DEFAULT_EDGE_FLAGS,
  isWhitelabeled: true,
};

export interface OrgEdgeFlags {
  bypassExtendedGithubAuth: boolean;
}

export const DEFAULT_ORG_EDGE_FLAGS: OrgEdgeFlags = {
  bypassExtendedGithubAuth: false,
};

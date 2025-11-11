export interface OnboardingDocsRequest {
    orgName: string;
    docsSiteName: string;
    docsSiteUrl: string;
    docsSiteUrlAvailable: boolean | null;
    faviconUrl: string | null;
    logoUrl: string | null;
    primaryColorHex: string | null;
    existingDocsSite: string;
    openApiSpecUrls: Array<{
        fileName: string;
        assetUrl: string;
    }>;
}

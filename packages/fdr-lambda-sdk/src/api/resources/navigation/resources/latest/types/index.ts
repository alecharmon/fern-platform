export interface FeatureFlagOptions {
    flag: string;
    fallbackValue: unknown | undefined;
    match: unknown | undefined;
}

export interface WithFeatureFlags {
    featureFlags: FeatureFlagOptions[] | undefined;
}

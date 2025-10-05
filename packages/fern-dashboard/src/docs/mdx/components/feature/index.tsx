import { Feature as FeatureComponent } from "@fern-docs/components/feature-flags/Feature";
import { FeatureFlagDebug } from "@fern-docs/components/feature-flags/FeatureFlagDebug";
import type { FeatureProps } from "@fern-docs/components/feature-flags/types";

export const Feature = (props: FeatureProps) => (
    <FeatureFlagDebug {...props}>
        <FeatureComponent {...props} />
    </FeatureFlagDebug>
);

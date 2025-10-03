import { PropsWithChildren } from "react";

import type { FernNavigation } from "@fern-api/fdr-sdk";

import { Badge } from "../badges";
import { useIsLocalPreview } from "../contexts/local-preview";

export const FeatureFlagDebug = (props: PropsWithChildren<FernNavigation.FeatureFlagOptions>) => {
    const isLocalPreview = useIsLocalPreview();
    if (!isLocalPreview) {
        return props.children;
    }

    return (
        <>
            <Badge className="my-4">Feature flag: {props.flag}</Badge>
            {props.children}
        </>
    );
};

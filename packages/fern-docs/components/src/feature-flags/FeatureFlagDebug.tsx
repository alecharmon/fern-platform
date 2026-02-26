/*eslint i18next/no-literal-string: off*/
import type { FernNavigation } from "@fern-api/fdr-sdk";
import type { PropsWithChildren } from "react";

import { Badge } from "../badges";
import { useIsLocalPreview } from "../contexts/local-preview";

export const FeatureFlagDebug = (props: PropsWithChildren<FernNavigation.FeatureFlagOptions>) => {
    const isLocalPreview = useIsLocalPreview();
    if (!isLocalPreview) {
        return props.children;
    }

    return (
        <>
            <Badge className="my-4">
                {"Feature flag: "}
                {props.flag}
            </Badge>
            {props.children}
        </>
    );
};

import type React from "react";

import { useOrgSvgLogo } from "@/state/useOrgSvgLogo";
import { cn } from "@/utils/utils";

import styles from "./SvgOrgLogo.module.scss";

export declare namespace SvgOrgLogo {
    export interface Props {
        svgUrl: string;
        fallback: React.JSX.Element;
    }
}

export function SvgOrgLogo({ svgUrl, fallback }: SvgOrgLogo.Props) {
    const logo = useOrgSvgLogo(svgUrl);

    switch (logo.type) {
        case "loaded":
            return (
                <div
                    className={cn("flex flex-1", styles.svgOrgLogo)}
                    dangerouslySetInnerHTML={{ __html: logo.value }}
                />
            );
        case "failed":
            return fallback;
        case "loading":
        case "notStartedLoading":
            return null;
    }
}

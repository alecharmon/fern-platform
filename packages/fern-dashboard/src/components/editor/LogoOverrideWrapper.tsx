"use client";

import { DEFAULT_LOGO_HEIGHT } from "@fern-api/docs-utils";
import type React from "react";
import { useThemingPanel } from "@/providers/ThemingPanelProvider";

export function LogoOverrideWrapper({ children }: { children: React.ReactNode }) {
    const { logoOverrideUrl } = useThemingPanel();

    if (logoOverrideUrl) {
        return (
            // biome-ignore lint/performance/noImgElement: dynamic logo preview
            <img
                src={logoOverrideUrl}
                alt="Logo"
                style={{ height: DEFAULT_LOGO_HEIGHT, width: "auto" }}
                className="max-h-full object-contain max-md:!max-h-8"
            />
        );
    }

    return <>{children}</>;
}

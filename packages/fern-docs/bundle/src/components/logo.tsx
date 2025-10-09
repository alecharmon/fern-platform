"use client";

import React from "react";

import type { LogoConfiguration } from "@fern-api/docs-utils/types/logo-configuration";
import { cn } from "@fern-docs/components/cn";
import { MaybeFernLink } from "@fern-docs/components/FernLink";
import { AbstractLogo } from "@fern-docs/components/abstract/logo";

import { LogoText } from "@/state/logo-text";
import { trackInternal } from "./analytics/track";

export function Logo({ logo, className, alt }: { logo: LogoConfiguration; className?: string; alt?: string }) {
    const handleLogoError = React.useCallback((theme: "light" | "dark", src: string) => {
        trackInternal("logo_load_failed", {
            theme,
            src,
            host: typeof window !== "undefined" ? window.location.host : undefined
        });
    }, []);

    return (
        <MaybeFernLink href={logo.href} className={cn(className, "flex items-center")}>
            <AbstractLogo logo={logo} alt={alt} onError={handleLogoError} />
            <LogoText className="ml-1" />
        </MaybeFernLink>
    );
}

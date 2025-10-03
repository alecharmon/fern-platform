import React from "react";

import { DEFAULT_LOGO_HEIGHT } from "@fern-api/docs-utils";
import { LogoConfiguration } from "@fern-api/docs-utils/types/logo-configuration";

import { FernImage } from "../FernImage";
import { cn } from "../cn";

export function AbstractLogo({ logo, alt }: { logo: LogoConfiguration; alt?: string }) {
    const { light, dark, height } = logo;

    const style = {
        height: height ?? DEFAULT_LOGO_HEIGHT,
        width: "auto"
    };

    return (
        <>
            {light && (
                <FernImage
                    className={cn("max-h-full object-contain max-md:!max-h-8", {
                        "block dark:hidden": !!dark
                    })}
                    alt={alt ?? light.alt ?? "Logo"}
                    src={light.src}
                    height={light.height}
                    width={light.width}
                    blurDataURL={light.blurDataURL}
                    priority
                    loading="eager"
                    quality={100}
                    style={style}
                />
            )}
            {dark && (
                <FernImage
                    className={cn("max-h-full object-contain max-md:!max-h-8", {
                        "hidden dark:block": !!light
                    })}
                    alt={alt ?? dark.alt ?? "Logo"}
                    src={dark.src}
                    height={dark.height}
                    width={dark.width}
                    blurDataURL={dark.blurDataURL}
                    priority
                    loading="eager"
                    quality={100}
                    style={style}
                />
            )}
        </>
    );
}

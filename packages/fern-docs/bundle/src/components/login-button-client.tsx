"use client";

import type { ComponentProps } from "react";

import { LogInIcon, LogOutIcon } from "lucide-react";

import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { WithReturnTo } from "@fern-docs/components/header/WithReturnTo";

export function LoginButtonClient({
    authed,
    returnToQueryParam,
    showIcon = false,
    ...props
}: {
    authed: boolean;
    returnToQueryParam: string;
    showIcon?: boolean;
} & ComponentProps<typeof ButtonLink>) {
    return (
        <WithReturnTo queryParam={returnToQueryParam}>
            <ButtonLink variant="outline" {...props}>
                {authed ? "Logout" : "Login"}
                {showIcon && (authed ? <LogOutIcon /> : <LogInIcon />)}
            </ButtonLink>
        </WithReturnTo>
    );
}

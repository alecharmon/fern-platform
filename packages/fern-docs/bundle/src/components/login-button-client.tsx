"use client";

import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { WithReturnTo } from "@fern-docs/components/header/WithReturnTo";
import { LogInIcon, LogOutIcon } from "lucide-react";
import type { ComponentProps } from "react";

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
            <ButtonLink variant="outline" {...props} target="_self">
                {authed ? "Logout" : "Login"}
                {showIcon && (authed ? <LogOutIcon /> : <LogInIcon />)}
            </ButtonLink>
        </WithReturnTo>
    );
}

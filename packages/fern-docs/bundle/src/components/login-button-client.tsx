"use client";

import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { WithReturnTo } from "@fern-docs/components/header/WithReturnTo";
import { LogInIcon, LogOutIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { I18N } from "@/constants";

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
                {authed ? I18N.auth.logout : I18N.auth.login}
                {showIcon && (authed ? <LogOutIcon /> : <LogInIcon />)}
            </ButtonLink>
        </WithReturnTo>
    );
}

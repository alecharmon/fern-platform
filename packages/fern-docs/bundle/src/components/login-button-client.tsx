"use client";

import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { WithReturnTo } from "@fern-docs/components/header/WithReturnTo";
import { LogInIcon, LogOutIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { i18n } from "@/constants";

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
                {authed ? i18n.auth.logout : i18n.auth.login}
                {showIcon && (authed ? <LogOutIcon /> : <LogInIcon />)}
            </ButtonLink>
        </WithReturnTo>
    );
}

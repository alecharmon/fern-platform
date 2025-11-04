"use client";

import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { WithReturnTo } from "@fern-docs/components/header/WithReturnTo";
import { t } from "@fern-docs/i18n";
import { LogInIcon, LogOutIcon } from "lucide-react";
import type { ComponentProps } from "react";

export function LoginButtonClient({
    authed,
    returnToQueryParam,
    showIcon = false,
    lang,
    ...props
}: {
    authed: boolean;
    returnToQueryParam: string;
    showIcon?: boolean;
    lang: string;
} & ComponentProps<typeof ButtonLink>) {
    return (
        <WithReturnTo queryParam={returnToQueryParam}>
            <ButtonLink variant="outline" {...props} target="_self">
                {authed ? t(lang).auth.logout : t(lang).auth.login}
                {showIcon && (authed ? <LogOutIcon /> : <LogInIcon />)}
            </ButtonLink>
        </WithReturnTo>
    );
}

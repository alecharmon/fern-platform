"use client";

import { Button } from "@fern-docs/components/FernButtonV2";
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
    href,
    as: _as,
    replace: _replace,
    scroll: _scroll,
    shallow: _shallow,
    passHref: _passHref,
    prefetch: _prefetch,
    ref: _ref,
    ...props
}: {
    authed: boolean;
    returnToQueryParam: string;
    showIcon?: boolean;
    lang: string;
} & ComponentProps<typeof ButtonLink>) {
    if (authed) {
        return <LogoutButton showIcon={showIcon} lang={lang} href={href} {...props} />;
    }

    return (
        <WithReturnTo queryParam={returnToQueryParam}>
            <ButtonLink variant="outline" href={href} {...props} target="_self">
                {t(lang).auth.login}
                {showIcon && <LogInIcon />}
            </ButtonLink>
        </WithReturnTo>
    );
}

function LogoutButton({
    showIcon,
    lang,
    href,
    ...props
}: {
    showIcon?: boolean;
    lang: string;
    href: ComponentProps<typeof ButtonLink>["href"];
} & Omit<ComponentProps<typeof Button>, "onClick">) {
    const handleLogout = () => {
        window.location.replace(String(href));
    };

    return (
        <Button variant="outline" onClick={handleLogout} {...props}>
            {t(lang).auth.logout}
            {showIcon && <LogOutIcon />}
        </Button>
    );
}

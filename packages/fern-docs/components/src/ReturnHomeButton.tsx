"use client";

import { t } from "@fern-docs/i18n";
import { FernLinkButton } from "./FernLinkButton";
import { useBasePath } from "./state/navigation";

export default function ReturnHomeButton({ lang }: { lang: string }) {
    const basePath = useBasePath();
    // When Next.js basePath is configured (self-hosted), Link auto-prepends it,
    // so use "/" to avoid double-basePath (e.g. /docs/docs).
    const href = process.env.NEXT_PUBLIC_BASE_PATH ? "/" : basePath;
    return <FernLinkButton href={href} text={t(lang).buttons.returnHome} intent="primary" />;
}

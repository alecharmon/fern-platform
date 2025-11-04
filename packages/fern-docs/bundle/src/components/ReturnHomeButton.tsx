"use client";

import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { useBasePath } from "@fern-docs/components/state/navigation";

import { t } from "@fern-docs/i18n";

export default function ReturnHomeButton({ lang }: { lang: string }) {
    const basePath = useBasePath();
    return <FernLinkButton href={basePath} text={t(lang).buttons.returnHome} intent="primary" />;
}

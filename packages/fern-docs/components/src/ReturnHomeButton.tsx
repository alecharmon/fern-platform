"use client";

import { t } from "@fern-docs/i18n";
import { FernLinkButton } from "./FernLinkButton";
import { useBasePath } from "./state/navigation";

export default function ReturnHomeButton({ lang }: { lang: string }) {
    const basePath = useBasePath();
    return <FernLinkButton href={basePath} text={t(lang).buttons.returnHome} intent="primary" />;
}

"use client";

import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { useBasePath } from "@fern-docs/components/state/navigation";

import { i18n } from "@/constants";

export default function ReturnHomeButton() {
    const basePath = useBasePath();
    return <FernLinkButton href={basePath} text={i18n.buttons.returnHome} intent="primary" />;
}

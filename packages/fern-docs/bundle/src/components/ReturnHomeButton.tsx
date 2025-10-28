"use client";

import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { useBasePath } from "@fern-docs/components/state/navigation";

import { I18N } from "@/constants";

export default function ReturnHomeButton() {
    const basePath = useBasePath();
    return <FernLinkButton href={basePath} text={I18N.buttons.returnHome} intent="primary" />;
}

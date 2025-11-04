import { t } from "@fern-docs/i18n";
import type { ReactElement } from "react";

import { PlaygroundCardSkeleton } from "./PlaygroundCardSkeleton";

export function PlaygroundEndpointFormSectionSkeleton({ lang }: { lang: string }): ReactElement<any> {
    return (
        <section>
            <PlaygroundCardSkeleton className="mb-4 w-fit">
                <h5 className="inline">{t(lang).apiReference.parameters}</h5>
            </PlaygroundCardSkeleton>
            <PlaygroundCardSkeleton className="h-32" />
        </section>
    );
}

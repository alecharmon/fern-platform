import type { ReactElement } from "react";

import { i18n } from "@/constants";

import { PlaygroundCardSkeleton } from "./PlaygroundCardSkeleton";

export function PlaygroundEndpointFormSectionSkeleton(): ReactElement<any> {
    return (
        <section>
            <PlaygroundCardSkeleton className="mb-4 w-fit">
                <h5 className="inline">{i18n.apiReference.parameters}</h5>
            </PlaygroundCardSkeleton>
            <PlaygroundCardSkeleton className="h-32" />
        </section>
    );
}

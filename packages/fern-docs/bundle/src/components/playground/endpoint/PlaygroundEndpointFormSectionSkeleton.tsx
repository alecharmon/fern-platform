import type { ReactElement } from "react";

import { I18N } from "@/constants";

import { PlaygroundCardSkeleton } from "./PlaygroundCardSkeleton";

export function PlaygroundEndpointFormSectionSkeleton(): ReactElement<any> {
    return (
        <section>
            <PlaygroundCardSkeleton className="mb-4 w-fit">
                <h5 className="inline">{I18N.apiReference.parameters}</h5>
            </PlaygroundCardSkeleton>
            <PlaygroundCardSkeleton className="h-32" />
        </section>
    );
}

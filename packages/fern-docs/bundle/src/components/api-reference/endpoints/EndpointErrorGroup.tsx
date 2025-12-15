import "server-only";

import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { ErrorResponse } from "@fern-api/fdr-sdk/api-definition";
import { EndpointErrorGroupClient } from "@fern-docs/components/api-reference/endpoints/EndpointErrorGroupClient";
import { sortBy } from "es-toolkit/array";

import { EndpointError } from "./EndpointError";

export function EndpointErrorGroup({
    errors,
    types,
    lang
}: {
    errors: ErrorResponse[];
    types: Record<string, ApiDefinition.TypeDefinition>;
    lang: string;
}) {
    return (
        <EndpointErrorGroupClient
            errors={sortBy(errors, [(e) => e.statusCode, (e) => e.name]).map((error) => ({
                children: <EndpointError error={error} availability={error.availability} types={types} lang={lang} />,
                data: error
            }))}
        />
    );
}

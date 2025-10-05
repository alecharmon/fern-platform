import "server-only";

import React from "react";

import { sortBy } from "es-toolkit/array";

import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { ErrorResponse } from "@fern-api/fdr-sdk/api-definition";

import { EndpointError } from "./EndpointError";
import { EndpointErrorGroupClient } from "./EndpointErrorGroupClient";

export function EndpointErrorGroup({
    errors,
    types
}: {
    errors: ErrorResponse[];
    types: Record<string, ApiDefinition.TypeDefinition>;
}) {
    return (
        <EndpointErrorGroupClient
            errors={sortBy(errors, [(e) => e.statusCode, (e) => e.name]).map((error) => ({
                children: <EndpointError error={error} availability={error.availability} types={types} />,
                data: error
            }))}
        />
    );
}

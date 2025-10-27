"use client";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import type { ReactNode } from "react";

import { ApiDefinitionIdProvider } from "@/contexts/ApiDefinitionIdContext";

export function ApiReferenceClientWrapper({
    apiDefinitionId,
    children
}: {
    apiDefinitionId: FdrAPI.ApiDefinitionId | undefined;
    children: ReactNode;
}) {
    return <ApiDefinitionIdProvider value={apiDefinitionId}>{children}</ApiDefinitionIdProvider>;
}

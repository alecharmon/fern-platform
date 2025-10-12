import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import React from "react";

import { Chip } from "@/components/Chip";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

export function EnumValue({ enumValue }: { enumValue: ApiDefinition.EnumValue }) {
    return (
        <Chip
            name={enumValue.value}
            description={
                enumValue.description && <MdxServerComponentProseSuspense mdx={enumValue.description} size="xs" />
            }
        />
    );
}

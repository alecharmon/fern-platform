"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

import { Chip } from "@fern-docs/components/Chip";
import { MdxContent } from "@/docs/mdx/components/MdxContent";

export function EnumValue({ enumValue, lang = "en" }: { enumValue: ApiDefinition.EnumValue; lang?: string }) {
    return (
        <Chip
            name={enumValue.value}
            description={enumValue.description ? <MdxContent mdx={enumValue.description} size="xs" /> : undefined}
            lang={lang}
        />
    );
}

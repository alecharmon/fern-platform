import type React from "react";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

export interface EnumValueProps {
    enumValue: ApiDefinition.EnumValue;
    Chip: React.ComponentType<{
        name: string;
        description?: React.ReactNode;
    }>;
    MdxRenderer?: React.ComponentType<{
        mdx: string | undefined;
        size?: string;
        className?: string;
    }>;
}

export function EnumValue({ enumValue, Chip, MdxRenderer }: EnumValueProps) {
    return (
        <Chip
            name={enumValue.value}
            description={
                enumValue.description && MdxRenderer ? <MdxRenderer mdx={enumValue.description} size="xs" /> : undefined
            }
        />
    );
}

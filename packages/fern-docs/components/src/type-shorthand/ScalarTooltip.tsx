"use client";

import type { ReactNode } from "react";
import { FernTooltip } from "../FernTooltip";

interface ScalarTooltipProps {
    name: string;
    description: string | undefined;
}

/**
 * Renders a scalar type with a tooltip showing its description if available.
 * The scalar name is shown with a dotted underline to indicate it's hoverable.
 */
export function ScalarTooltip({ name, description }: ScalarTooltipProps): ReactNode {
    if (!description) {
        return name;
    }
    return (
        <FernTooltip content={description}>
            <span className="cursor-pointer border-b border-dotted border-current">{name}</span>
        </FernTooltip>
    );
}

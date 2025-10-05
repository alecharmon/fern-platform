import type { ComponentProps, ReactElement } from "react";

import { FernButtonGroup } from "@fern-docs/components/FernButton";
import { cn } from "@fern-docs/components/cn";

export function ButtonGroup(props: ComponentProps<typeof FernButtonGroup>): ReactElement<any> {
    return <FernButtonGroup {...props} className={cn(props.className, "m-mdx flex-wrap")} />;
}

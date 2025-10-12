import { cn } from "@fern-docs/components/cn";

import { FernButtonGroup } from "@fern-docs/components/FernButton";
import type { ComponentProps, ReactElement } from "react";

export function ButtonGroup(props: ComponentProps<typeof FernButtonGroup>): ReactElement<any> {
    return <FernButtonGroup {...props} className={cn(props.className, "m-mdx flex-wrap")} />;
}

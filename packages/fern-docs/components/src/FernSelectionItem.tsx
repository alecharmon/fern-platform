"use client";

import { cn } from "./cn";

/**
 * This component is used to render a selection item. It is used within dropdowns and as a dropdown trigger.
 * This is reused for both the product and version dropdowns.
 *
 * @param icon: the icon to be rendered
 * @param title: the title to be rendered
 * @param subtitle: the subtitle to be rendered
 * @param dense: whether the item is dense
 * @returns the rendered product item
 */
export function FernSelectionItem({
    image,
    icon,
    title,
    subtitle,
    dense = false,
    endIcon,
    className,
    testId
}: {
    image?: React.ReactNode;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    dense?: boolean;
    endIcon?: React.ReactNode;
    className?: string;
    testId?: string;
}) {
    return (
        <div className={cn("fern-selection-item", { dense }, className)} data-testid={testId}>
            <div className="flex flex-1 items-center gap-2">
                <div className={cn("fern-selection-item-icon", { "use-icon": !image })}>{image ?? icon}</div>

                <div className={cn("flex flex-col", { "gap-1": !dense })}>
                    <p className="fern-selection-item-title">{title}</p>
                    {subtitle ? (
                        <p className="fern-selection-item-subtitle text-(color:--grayscale-a9) text-sm leading-tight">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
            </div>
            <div className="fern-selection-item-end-icon">{endIcon}</div>
        </div>
    );
}

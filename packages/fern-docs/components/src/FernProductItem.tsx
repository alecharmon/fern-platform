"use client";

import { cn } from "./cn";
import type { FernDropdown } from "./FernDropdown";
import { checkIsExternalUrl, FernLink, toUrlObject } from "./FernLink";
import { FernSelectionItem } from "./FernSelectionItem";

/**
 * This component is used to render a product option. Since this could be used within dropdowns
 * or other components, we separate the logic for rendering the product item into its own component.
 *
 * @param option: the product to be rendered
 * @param highlighted: whether the item is highlighted
 * @returns the rendered product item
 */
export function FernProductItem({
    option,
    dense = false,
    target
}: {
    option: FernDropdown.ProductOption;
    dense?: boolean;
    target?: string;
}) {
    const href = option.href ?? "";
    const url = toUrlObject(href);
    const isExternal = checkIsExternalUrl(url);

    const content = (
        <div className={cn("fern-product-item", option.className)}>
            <FernSelectionItem
                image={option.image}
                icon={option.icon}
                title={option.title}
                subtitle={option.subtitle}
                dense={dense}
            />
        </div>
    );

    if (!href) {
        return content;
    }

    if (isExternal) {
        return (
            <a className="fern-product-item-link" href={href} target={target}>
                {content}
            </a>
        );
    }

    return (
        <FernLink className="fern-product-item-link" href={href} target={target}>
            {content}
        </FernLink>
    );
}

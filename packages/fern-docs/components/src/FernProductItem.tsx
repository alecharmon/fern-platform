"use client";

import { cn } from "./cn";
import type { FernDropdown } from "./FernDropdown";
import { FernSelectionItem } from "./FernSelectionItem";

/**
 * This component is used to render a product option. Since this could be used within dropdowns
 * or other components, we separate the logic for rendering the product item into its own component.
 *
 * @param option: the product to be rendered
 * @param highlighted: whether the item is highlighted
 * @returns the rendered product item
 */
export function FernProductItem({ option, dense = false }: { option: FernDropdown.ProductOption; dense?: boolean }) {
    return (
        <a href={option.href}>
            <div className={cn("fern-product-item", option.className)}>
                <FernSelectionItem
                    image={option.image}
                    icon={option.icon}
                    title={option.title}
                    subtitle={option.subtitle}
                    dense={dense}
                />
            </div>
        </a>
    );
}

"use client";

import { slugToHref } from "@fern-api/docs-utils";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import { useIsDesktop } from "@fern-ui/react-commons";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "../cn";
import { FernDropdown } from "../FernDropdown";
import { FernSelectionItem } from "../FernSelectionItem";
import { useCurrentProductId, useCurrentProductSlug } from "../state/navigation";

export interface ProductDropdownItem {
    productId: string;
    title: string;
    subtitle?: string;
    slug?: string;
    href?: string;
    defaultSlug?: string;
    icon?: React.ReactNode;
    image?: React.ReactNode;
    default: boolean;
}

export function ProductDropdownClient({
    products,
    fallbackProduct,
    useDenseLayout = false
}: {
    products: ProductDropdownItem[];
    fallbackProduct: FernNavigation.ProductNode;
    useDenseLayout?: boolean;
}) {
    const isDesktop = useIsDesktop();
    const currentProductId = useCurrentProductId();
    const currentProductSlug = useCurrentProductSlug();

    const currentProduct =
        products.find((product) => product.productId === currentProductId) ??
        products.find((product) => product.default) ??
        products.find((product) => product.productId === fallbackProduct.productId);

    if (!currentProduct) {
        return null;
    }

    return (
        <FernDropdown
            value={currentProductId}
            options={products.map(({ icon, image, productId, title, slug, subtitle, defaultSlug, href }) => {
                const productHref =
                    href ??
                    slugToHref(
                        pickProductSlug({
                            currentProductSlug,
                            defaultSlug,
                            slug: slug ?? ""
                        })
                    );

                return {
                    type: "product",
                    id: productId,
                    title,
                    subtitle,
                    value: productId,
                    href: productHref,
                    dense: !isDesktop || useDenseLayout,
                    icon,
                    image
                };
            })}
            contentProps={{
                "data-testid": "product-dropdown-content"
            }}
            side="bottom"
            align={isDesktop ? "start" : "center"}
            triggerAsChild={false}
            className="fern-product-selector w-full lg:w-auto"
            radioGroupProps={{
                className: "fern-product-selector-radio-group"
            }}
            searchable={products.length > 12}
        >
            <div
                className={cn("product-dropdown-trigger hidden h-9", {
                    "lg:flex": !useDenseLayout
                })}
                data-testid="product-dropdown"
            >
                <p className="product-item-title w-fit">{currentProduct?.title}</p>
                <ChevronDown className="size-icon transition-transform data-[state=open]:rotate-180" />
            </div>

            <FernSelectionItem
                icon={currentProduct.icon}
                title={currentProduct.title}
                subtitle={currentProduct.subtitle}
                dense
                endIcon={<ChevronsUpDown className="size-icon" />}
                className={cn("product-dropdown-trigger", {
                    "lg:hidden!": !useDenseLayout
                })}
                testId="product-dropdown"
            />
        </FernDropdown>
    );

    function pickProductSlug({
        currentProductSlug,
        defaultSlug,
        slug
    }: {
        currentProductSlug?: string;
        defaultSlug?: string;
        slug: string;
    }): string {
        if (!defaultSlug) {
            return slug;
        }

        if (currentProductSlug != null && slug.startsWith(currentProductSlug)) {
            return slug;
        }

        return defaultSlug;
    }
}

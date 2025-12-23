"use client";

import { slugToHref } from "@fern-api/docs-utils";
import type { ProductSwitcherThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import { useIsDesktop } from "@fern-ui/react-commons";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "../cn";
import { FernDropdown } from "../FernDropdown";
import { FernLink } from "../FernLink";
import { FernSelectionItem } from "../FernSelectionItem";
import { useCurrentProductId, useCurrentProductSlug } from "../state/navigation";

export interface ProductDropdownItem {
    productId: string;
    title: string;
    subtitle?: string;
    slug?: string;
    href?: string;
    target?: string;
    defaultSlug?: string;
    icon?: React.ReactNode;
    image?: React.ReactNode;
    default: boolean;
}

export function ProductDropdownClient({
    products,
    fallbackProduct,
    useDenseLayout = false,
    lang,
    productSwitcherTheme
}: {
    products: ProductDropdownItem[];
    fallbackProduct: FernNavigation.ProductNode;
    useDenseLayout?: boolean;
    lang: string;
    productSwitcherTheme?: ProductSwitcherThemeConfig;
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

    const isToggleTheme = productSwitcherTheme === "toggle";

    if (isToggleTheme && isDesktop) {
        return (
            <div className="fern-product-selector" data-testid="product-toggle">
                {products.map((product) => {
                    const productHref =
                        product.href ??
                        slugToHref(
                            pickProductSlug({
                                currentProductSlug,
                                defaultSlug: product.defaultSlug,
                                slug: product.slug ?? ""
                            })
                        );
                    const isActive = product.productId === currentProduct.productId;
                    return (
                        <FernLink
                            key={product.productId}
                            href={productHref}
                            target={product.target}
                            className="product-dropdown-trigger"
                            data-active={isActive}
                        >
                            {product.title}
                        </FernLink>
                    );
                })}
            </div>
        );
    }

    return (
        <FernDropdown
            value={currentProductId}
            options={products.map(({ icon, image, productId, title, slug, subtitle, defaultSlug, href, target }) => {
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
                    target,
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
            className="fern-product-selector group w-full lg:w-auto"
            radioGroupProps={{
                className: "fern-product-selector-radio-group"
            }}
            searchable={products.length > 12}
            lang={lang}
        >
            <div
                className={cn("product-dropdown-trigger hidden h-9", {
                    "lg:flex": !useDenseLayout
                })}
                data-testid="product-dropdown"
            >
                <p className="product-item-title w-fit">{currentProduct?.title}</p>
                <ChevronDown className="size-icon animate-dropdown-chevron" />
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

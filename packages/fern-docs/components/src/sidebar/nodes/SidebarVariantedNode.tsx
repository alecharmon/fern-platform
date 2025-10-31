"use client";

import { slugToHref } from "@fern-api/docs-utils";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import React, { useCallback, useState } from "react";

import { cn } from "../../cn";
import { FernLink } from "../../FernLink";
import { FernScrollArea } from "../../FernScrollArea";
import { FernSelectionItem } from "../../FernSelectionItem";
import { processIcon } from "../../processIcon";
import { useCurrentVariantId } from "../../state/navigation";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarNavigationChild } from "./SidebarNavigationChild";
import { SidebarRootChild } from "./SidebarRootChild";

interface SidebarVariantedNodeProps {
    node: FernNavigation.VariantedNode;
    depth: number;
    renderOptions: SidebarRenderOptions;
}

export function SidebarVariantedNode({ node, depth, renderOptions }: SidebarVariantedNodeProps): ReactNode {
    const forceClientRender = renderOptions.forceClientRender ?? false;
    const clientVariantId = useCurrentVariantId();
    const [isOpen, setIsOpen] = useState(false);

    // Use server-side variant ID from renderOptions for SSR, fall back to client state after hydration
    const currentVariantId = renderOptions.currentVariantId ?? clientVariantId;

    // Find the current variant or default to the one marked as default
    const currentVariant =
        node.children.find((variant) => variant.variantId === currentVariantId) ??
        node.children.find((variant) => variant.default) ??
        node.children[0];

    const handleOpenChange = useCallback((toOpen: boolean) => {
        setIsOpen(toOpen);
    }, []);

    if (!currentVariant) {
        return null;
    }

    // Prepare the icon/image for the trigger
    const triggerIcon = currentVariant.icon ? processIcon(currentVariant, undefined, forceClientRender) : undefined;

    // Get pre-resolved image from renderOptions (resolved on server)
    const triggerImage = renderOptions.variantImages?.[currentVariant.variantId];

    return (
        <div className="relative">
            {/* Variant selector dropdown */}
            <DropdownMenu.Root onOpenChange={handleOpenChange} open={isOpen} modal={false}>
                <DropdownMenu.Trigger asChild={false} className="fern-variant-selector w-full">
                    <FernSelectionItem
                        image={triggerImage}
                        icon={triggerIcon}
                        title={currentVariant.title}
                        subtitle={currentVariant.subtitle}
                        dense
                        endIcon={<ChevronsUpDown className="size-icon" />}
                        className={cn("w-full")}
                        testId="variant-dropdown"
                    />
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content
                        sideOffset={4}
                        collisionPadding={4}
                        side="bottom"
                        align="start"
                        hideWhenDetached
                        className={cn("fern-dropdown [&_svg]:size-icon")}
                    >
                        <FernScrollArea rootClassName="min-h-0 shrink" className="p-1" scrollbars="vertical">
                            <DropdownMenu.RadioGroup value={currentVariant.variantId} className="space-y-1">
                                {node.children.map((variant) => {
                                    const href = slugToHref(variant.pointsTo ?? variant.slug);
                                    // Process icon properly by passing the full variant object
                                    const icon = variant.icon
                                        ? processIcon(variant, undefined, forceClientRender)
                                        : undefined;
                                    // Get pre-resolved image from renderOptions (resolved on server)
                                    const image = renderOptions.variantImages?.[variant.variantId];

                                    return (
                                        <DropdownMenu.RadioItem
                                            key={variant.variantId}
                                            value={variant.variantId}
                                            asChild
                                        >
                                            <FernLink
                                                href={href}
                                                scroll={true}
                                                className={cn("fern-dropdown-item", variant.hidden && "opacity-50")}
                                            >
                                                <div className="flex w-full items-center gap-2">
                                                    {/* Icon or Image */}
                                                    {(image || icon) && (
                                                        <div
                                                            className={cn(
                                                                "m-0.5 flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-2 p-0.5 text-current",
                                                                icon && !image && "border border-current/30"
                                                            )}
                                                        >
                                                            {image || icon}
                                                        </div>
                                                    )}

                                                    {/* Title and Subtitle */}
                                                    <div className="flex flex-1 flex-col gap-1">
                                                        <p className="font-bold leading-tight text-current lg:text-sm">
                                                            {variant.title}
                                                        </p>
                                                        {variant.subtitle && (
                                                            <p className="text-xs leading-tight text-current opacity-60">
                                                                {variant.subtitle}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Check indicator for selected item */}
                                                    <DropdownMenu.ItemIndicator asChild>
                                                        <Check className="size-icon" />
                                                    </DropdownMenu.ItemIndicator>
                                                </div>
                                            </FernLink>
                                        </DropdownMenu.RadioItem>
                                    );
                                })}
                            </DropdownMenu.RadioGroup>
                        </FernScrollArea>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Render the selected variant's children */}
            <div className={cn("mt-2")}>
                {currentVariant.children.map((child) => {
                    // VariantChild can be sidebar-level or section-level items
                    // We need to determine if this should be rendered as a root child or navigation child
                    // Based on the discriminated union, VariantChild includes SidebarGroup which is a root-level item
                    if (child.type === "sidebarGroup") {
                        return <SidebarRootChild key={child.id} node={child} renderOptions={renderOptions} />;
                    }

                    // All other types are NavigationChild types
                    return (
                        <SidebarNavigationChild
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            renderOptions={renderOptions}
                        />
                    );
                })}
            </div>
        </div>
    );
}

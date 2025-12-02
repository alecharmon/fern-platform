"use client";

import React from "react";

export interface HashLinkProps extends Omit<React.ComponentPropsWithoutRef<"a">, "href"> {
    href: string;
}

export const HashLink = React.forwardRef<HTMLAnchorElement, HashLinkProps>(function HashLink(
    { href, onClick, ...props },
    ref
) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        // Extract hash from href (should be in format #anchorString)
        const hash = href.startsWith("#") ? href : `#${href}`;

        // Update the hash, which will trigger hashchange event
        // The hashchange listener in useTableOfContentsObserver will handle scrolling
        if (window.location.hash === hash) {
            // If hash is already set, manually dispatch hashchange event
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        } else {
            window.location.hash = hash;
        }

        // Call original onClick if provided
        onClick?.(e);
    };

    return <a ref={ref} href={href} onClick={handleClick} {...props} />;
});

HashLink.displayName = "HashLink";

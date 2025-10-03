"use client";

import React from "react";

import { HiddenSidebar } from "../state/layout";

// data-aside-state styling is only used in the changelog overview
// this should be deterministic
export const AsideAwareDiv = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<"div"> & {
        isFullPage: boolean;
    }
>(({ children, isFullPage, ...props }, ref) => {
    return (
        <div ref={ref} {...props} data-aside-state={isFullPage ? "hidden" : "visible"}>
            {isFullPage && <HiddenSidebar />}
            {children}
        </div>
    );
});

AsideAwareDiv.displayName = "AsideAwareDiv";

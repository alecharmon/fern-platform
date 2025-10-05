"use client";

import { useRouter } from "next/navigation";
import React from "react";

import { X } from "lucide-react";

import { FernButton } from "@fern-docs/components/FernButton";
import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { tunnel } from "@fern-ui/react-commons";

import { useUrlParams } from "@/hooks/use-url-params";

export const closeButton = tunnel();

export function PlaygroundCloseButton() {
    const { removeUrlParamFromPathname } = useUrlParams();
    return (
        <closeButton.In>
            <FernLinkButton
                icon={<X />}
                size="large"
                rounded
                variant="outlined"
                href={removeUrlParamFromPathname("explorer")}
                replace
                scroll={false}
            />
        </closeButton.In>
    );
}

export function InterceptedPlaygroundCloseButton() {
    const router = useRouter();
    const { removeUrlParamFromPathname } = useUrlParams();
    React.useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                router.replace(removeUrlParamFromPathname("explorer"));
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [router, removeUrlParamFromPathname]);
    return (
        <closeButton.In>
            <FernButton
                icon={<X />}
                size="large"
                rounded
                variant="outlined"
                onClick={() => {
                    router.replace(removeUrlParamFromPathname("explorer"));
                }}
            />
        </closeButton.In>
    );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";

const variants = {
    docs: {
        title: "Docs",
        description: "Beautiful API Documentation styled to match your brand",
        icon: "/assets/onboarding/onboarding_docs.svg",
        href: "/get-started/create-org?next=/get-started/:orgId/docs"
    },
    sdk: {
        title: "SDKs",
        description: "Publish idiomatic client libraries in popular languages",
        icon: "/assets/onboarding/onboarding_sdks.svg",
        href: "/get-started/sdks"
    }
} as const;

export function ProductCard({ variant }: { variant: "docs" | "sdk" }) {
    const config = variants[variant];
    const posthog = usePostHog();

    const handleClick = () => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_PRODUCT_SELECTED, {
            product: variant
        });
    };

    return (
        <Link
            href={config.href}
            onClick={handleClick}
            className="flex flex-col gap-4 p-4 border border-border rounded-xl hover:border-green-700 hover:shadow-xs hover:shadow-green-700/30 transition-colors max-w-[220px]"
        >
            <div className="flex items-center justify-center size-[40px]">
                <Image src={config.icon} alt={`${config.title} Icon`} width={40} height={40} />
            </div>
            <div className="flex flex-col">
                <h3 className="font-semibold text-lg mb-1">{config.title}</h3>
                <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
        </Link>
    );
}

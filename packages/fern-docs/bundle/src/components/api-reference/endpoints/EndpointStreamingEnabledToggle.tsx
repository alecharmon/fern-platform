"use client";

import { slugToHref } from "@fern-api/docs-utils";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useCurrentSlug } from "@fern-docs/components/hooks/use-current-pathname";
import { FERN_STREAM_ATOM } from "@fern-docs/components/state/stream";
import { useIsomorphicLayoutEffect } from "@fern-ui/react-commons";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";

import { StreamingEnabledToggle } from "./StreamingEnabledToggle";

export function EndpointStreamingEnabledToggle({
    node,
    lang
}: {
    node: FernNavigation.EndpointPairNode;
    lang: string;
}) {
    const router = useRouter();
    const [isStream, setIsStream] = useAtom(FERN_STREAM_ATOM);
    const currentSlug = useCurrentSlug();
    // TODO: this is a hack to ensure the toggle is always in sync with the current slug
    useIsomorphicLayoutEffect(() => {
        if (currentSlug === node.stream.slug) {
            setIsStream(true);
        } else if (currentSlug === node.nonStream.slug) {
            setIsStream(false);
        }
    }, [currentSlug, node.nonStream.slug, node.stream.slug, setIsStream]);
    return (
        <StreamingEnabledToggle
            className="ml-2 w-[200px]"
            value={isStream}
            setValue={(value) => {
                setIsStream(value);
                router.replace(slugToHref(value ? node.stream.slug : node.nonStream.slug), { scroll: true });
            }}
            lang={lang}
        />
    );
}

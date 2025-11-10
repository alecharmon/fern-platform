import { slugToHref } from "@fern-api/docs-utils";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { useInView } from "motion/react";
import { useRouter } from "next/navigation";
import { type RefObject, useEffect } from "react";

export function useApiPageCenterElement(
    ref: RefObject<HTMLDivElement | null>,
    slug: FernNavigation.Slug,
    skip = false
): void {
    const isInView = useInView(ref, {
        // https://stackoverflow.com/questions/54807535/intersection-observer-api-observe-the-center-of-the-viewport
        margin: "-50% 0px"
    });

    const shouldUpdateSlug = !skip && isInView;
    const router = useRouter();

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when shouldUpdateSlug or slug changes
    useEffect(() => {
        if (shouldUpdateSlug) {
            router.replace(slugToHref(slug), { scroll: false });
        }
    }, [shouldUpdateSlug, slug]);
}

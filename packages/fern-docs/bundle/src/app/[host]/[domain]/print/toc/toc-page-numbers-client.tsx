"use client";

import { PRINT_TOC_HYDRATED_DATA_ATTR, PRINT_TOC_PAGE_SELECTOR } from "@fern-api/docs-pdf";
import { useEffect } from "react";

type TocEntry = [slug: string, pageNumber: number];

declare global {
    interface Window {
        __FERN_TOC_PAGE_NUMBERS__?: TocEntry[];
    }
}

export function applyTocPageNumbers(entries: TocEntry[], root: Document = document) {
    const pageNumberBySlug = new Map(entries);
    const nodes = root.querySelectorAll<HTMLElement>("[data-fern-toc-page][data-fern-slug]");

    nodes.forEach((node) => {
        const slug = node.getAttribute("data-fern-slug") ?? "";
        const pageNumber = pageNumberBySlug.get(slug);
        node.textContent = pageNumber != null ? String(pageNumber) : "";
    });

    const tocRoot = root.querySelector<HTMLElement>(PRINT_TOC_PAGE_SELECTOR);
    if (tocRoot) {
        tocRoot.setAttribute(PRINT_TOC_HYDRATED_DATA_ATTR, "true");
    }
}

export function TocPageNumbersHydrator(): React.ReactNode {
    useEffect(() => {
        const entries = window.__FERN_TOC_PAGE_NUMBERS__;
        if (Array.isArray(entries)) {
            applyTocPageNumbers(entries);
        }
    }, []);

    return null;
}

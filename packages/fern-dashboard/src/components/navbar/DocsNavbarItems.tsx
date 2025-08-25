"use client";

import type { FdrAPI } from "@fern-api/fdr-sdk";

import { useMyDocsSites } from "@/state/useMyDocsSites";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";

import { DocsNavbarSubItems } from "./DocsNavbarSubItems";
import { ICON_SIZE, NavbarItem } from "./NavbarItem";

export function DocsNavbarItems() {
  const docsSites = useMyDocsSites();
  const firstDocsSite: FdrAPI.dashboard.DocsSite | undefined =
    docsSites.type === "loaded"
      ? (docsSites.value.docsSites[0] as FdrAPI.dashboard.DocsSite | undefined)
      : undefined;

  const pathname = usePathnameWithoutOrgName();
  const href = `/docs`;
  const isSelected = pathname.startsWith(href);
  const strokeColor = isSelected ? "var(--primary)" : "var(--gray-900)";

  return (
    <>
      <NavbarItem
        title="Docs"
        icon={
          <svg
            className={`book-open ${ICON_SIZE}`}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              id="right-lines"
              d="M10 5.03473C11.3269 3.84713 13.0791 3.125 15 3.125C15.8766 3.125 16.7181 3.27539 17.5 3.55176M10 16.9097C11.3269 15.7221 13.0791 15 15 15C15.8766 15 16.7181 15.1504 17.5 15.4268"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              id="right-edge"
              d="M17.5 3.55176V15.4268"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              id="left-lines"
              d="M10 5.03473C8.67311 3.84713 6.92089 3.125 5 3.125C4.12341 3.125 3.28195 3.27539 2.5 3.55176M10 16.9097C8.67311 15.7221 6.92089 15 5 15C4.12341 15 3.28195 15.1504 2.5 15.4268"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              id="left-edge"
              d="M2.5 3.55176V15.4268"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              id="middle"
              d="M10 5.03467V16.9097"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        href="/docs"
        hrefForActualLinking={
          firstDocsSite != null
            ? `/docs/${constructDocsUrlParam(getDocsSiteUrl(firstDocsSite))}`
            : undefined
        }
      />
      <DocsNavbarSubItems />
    </>
  );
}

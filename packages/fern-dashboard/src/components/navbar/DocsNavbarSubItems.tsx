"use client";

import { FdrAPI } from "@fern-api/fdr-sdk";

import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";

import { NavbarSubItem } from "./NavbarSubItem";

export function DocsNavbarSubItems({
  docsSites,
}: {
  docsSites: FdrAPI.dashboard.DocsSite[];
}) {
  return (
    <>
      {docsSites.map((docsSite) => {
        const url = getDocsSiteUrl(docsSite);
        return (
          <NavbarSubItem
            key={url}
            title={url}
            href={`/docs/${constructDocsUrlParam(url)}`}
          />
        );
      })}
    </>
  );
}

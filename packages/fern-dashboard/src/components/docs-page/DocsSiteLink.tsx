"use client";

import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { ExternalHoverLink } from "../ui/ExternalHoverLink";

export declare namespace DocsSiteLink {
  export interface Props {
    docsSiteUrl: FdrAPI.dashboard.DocsSiteUrl;
  }
}

export function DocsSiteLink({ docsSiteUrl }: DocsSiteLink.Props) {
  const { domain, path } = docsSiteUrl;

  return (
    <ExternalHoverLink
      href={new URL(path ?? "", `https://${domain}`).toString()}
      displayHref={`${domain}${path}`}
    />
  );
}

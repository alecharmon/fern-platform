"use client";

import { useDocsSite } from "@/state/useMyDocsSites";
import { DocsUrl } from "@/utils/types";

import Page404 from "../Page404";

export declare namespace DocsSiteClientWrapper {
  export interface Props {
    docsUrl: DocsUrl;
    children: React.ReactNode;
  }
}

export function DocsSiteClientWrapper({
  docsUrl,
  children,
}: DocsSiteClientWrapper.Props) {
  const docsSite = useDocsSite(docsUrl);

  if (docsSite.type === "loaded" && docsSite.value == null) {
    return <Page404 />;
  }

  return <>{children}</>;
}

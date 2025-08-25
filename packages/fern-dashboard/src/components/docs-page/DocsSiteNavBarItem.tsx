"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";

export declare namespace DocsSiteNavBarItem {
  export interface Props {
    title: string;
    href: string;
  }
}

const DOCS_PATHNAME_REGEX = /^(\/docs\/[^/]+)\/?([^/]*)\/?$/;

export function DocsSiteNavBarItem({ title, href }: DocsSiteNavBarItem.Props) {
  const orgName = useOrgNameFromPathname();
  const pathname = usePathnameWithoutOrgName();
  const { pathnameForDocsSite, tabPathname } = useMemo(() => {
    const match = DOCS_PATHNAME_REGEX.exec(pathname);
    const pathnameForDocsSite = match?.[1];
    const tabPathname = match?.[2];
    if (pathnameForDocsSite == null || tabPathname == null) {
      throw new Error(`Failed to parse tab pathname (pathname=${pathname})`);
    }
    return { pathnameForDocsSite, tabPathname };
  }, [pathname]);
  const isSelected = tabPathname === href;
  const isClickable = !isSelected;

  const className = cn(
    "flex flex-col pl-4 pr-4 transition first:pl-0 last:pr-0",
    isSelected ? "text-gray-1100" : "text-gray-900",
    isClickable && "hover:text-gray-1100"
  );

  const children = (
    <>
      <div className="flex pb-3">{title}</div>
      {isSelected && (
        <div className="bg-gray-1100 h-0.5 rounded-full dark:bg-gray-700" />
      )}
    </>
  );

  if (isClickable) {
    return (
      <Link
        className={className}
        href={`/${orgName}${pathnameForDocsSite}/${href}`}
      >
        {children}
      </Link>
    );
  } else {
    return <div className={className}>{children}</div>;
  }
}

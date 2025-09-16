"use client";

import { FdrAPI } from "@fern-api/fdr-sdk";

import Card from "../ui/card";
import { DocsSiteLink } from "./DocsSiteLink";
import { DocsSiteImage } from "./docs-site-image/DocsSiteImage";

export function DocsSiteOverviewCard({
  docsSite,
  githubProtectedArea,
}: {
  docsSite: FdrAPI.dashboard.DocsSite;
  githubProtectedArea: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="flex flex-col md:flex-row">
        <DocsSiteImage docsSite={docsSite} />
        <div className="flex min-w-0 flex-col gap-4 text-gray-900">
          <div className="flex flex-col gap-2">
            <p>Domains</p>
            <div className="flex flex-col items-start gap-1">
              {docsSite.urls.map((url) => (
                <DocsSiteLink
                  key={`${url.domain}${url.path}`}
                  docsSiteUrl={url}
                />
              ))}
            </div>
          </div>
          {githubProtectedArea}
        </div>
      </Card>
    </div>
  );
}

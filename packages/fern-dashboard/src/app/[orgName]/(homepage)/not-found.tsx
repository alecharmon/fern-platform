"use client";

import { useParams } from "next/navigation";

import NotFoundContent from "@/components/docs-page/NotFoundContent";

export default function OrgNotFound() {
  const { orgName } = useParams();

  return (
    <NotFoundContent>
      The requested organization <code>{orgName}</code> either doesn&apos;t
      exist or you don&apos;t have permissions to view it.
    </NotFoundContent>
  );
}

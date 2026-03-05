import "server-only";

import NotFoundContent from "@/components/NotFoundContent";

export const dynamic = "force-dynamic";
// Must match sibling revalidate value — see route-revalidate.ts
export const revalidate = 60;

export default async function NotFound() {
    return <NotFoundContent lang="en" />;
}

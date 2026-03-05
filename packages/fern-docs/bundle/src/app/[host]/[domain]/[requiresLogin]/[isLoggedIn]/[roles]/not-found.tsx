import "server-only";

import NotFoundContent from "@/components/NotFoundContent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NotFound() {
    return <NotFoundContent lang="en" />;
}

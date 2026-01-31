import "server-only";

import NotFoundContent from "@/components/NotFoundContent";

export const dynamic = "force-static";
export const revalidate = false;

export default async function NotFound() {
    return <NotFoundContent lang="en" />;
}

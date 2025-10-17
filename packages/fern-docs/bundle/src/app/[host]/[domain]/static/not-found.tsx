import "server-only";

import NotFoundContent from "@/components/NotFoundContent";

export const dynamic = "force-dynamic";

export default async function NotFound() {
    return <NotFoundContent />;
}

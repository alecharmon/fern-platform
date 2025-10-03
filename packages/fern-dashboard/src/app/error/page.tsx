import { LogoutButton } from "@/components/auth/LogoutButton";

import { parseErrorPageSearchParams } from "./searchParams";

export default async function ErrorPage({
    searchParams
}: {
    searchParams: Promise<Record<string, string | string[]>>;
}) {
    const { error, message } = await parseErrorPageSearchParams(searchParams);

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
            <div className="text-2xl">{error}</div>
            <div className="border-border rounded-lg border bg-gray-300 p-4 font-mono">{message}</div>
            <LogoutButton />
        </div>
    );
}

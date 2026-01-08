"use client";

import { useRouter } from "@bprogress/next/app";
import { CreateOrganizationForm } from "@/components/auth/CreateOrganizationForm";

export function CreateOrganizationContentClient({ accessToken }: { accessToken: string }) {
    const router = useRouter();
    const handleSuccess = (organizationId: string) => {
        router.push(`/${organizationId}/sdks`);
    };

    return <CreateOrganizationForm accessToken={accessToken} onSuccess={handleSuccess} />;
}

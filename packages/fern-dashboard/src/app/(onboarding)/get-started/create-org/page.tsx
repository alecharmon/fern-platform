import "server-only";

import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { sanitizePrefillOrgName } from "@/utils/organization";
import { CreateOrganizationStepClient } from "./CreateOrganizationStepClient";

const DEFAULT_NEXT_PATH = "/get-started/:orgId/docs";

function sanitizeNextHref(rawNext: string | string[] | undefined): string {
    const value = Array.isArray(rawNext) ? rawNext[0] : rawNext;
    if (!value) {
        return DEFAULT_NEXT_PATH;
    }

    try {
        const decoded = decodeURIComponent(value);
        if (decoded.startsWith("/") && !decoded.startsWith("//")) {
            return decoded;
        }
    } catch {
        // Ignore decoding errors and fall through to default
    }

    return DEFAULT_NEXT_PATH;
}

interface CreateOrgPageProps {
    searchParams?: Promise<{
        next?: string | string[];
        prefillOrgName?: string | string[];
    }>;
}

export default async function CreateOrganizationStepPage({ searchParams }: CreateOrgPageProps) {
    const session = await getCurrentSession();
    if (session == null || session.accessToken == null) {
        return await redirectToLogin();
    }

    const resolvedSearchParams = await searchParams;
    const nextHref = sanitizeNextHref(resolvedSearchParams?.next);
    const prefillOrgName = sanitizePrefillOrgName(resolvedSearchParams?.prefillOrgName);

    return (
        <>
            <BackArrow href="/get-started" />
            <SlideLeftTransition>
                <div className="flex h-full flex-col gap-3 max-w-[420px] px-7 lg:px-8">
                    <h1 className="text-2xl font-semibold">What is your organization name?</h1>
                    <p className="text-sm text-muted-foreground">Organizations are used to group your projects.</p>
                    <div className="mt-4">
                        <CreateOrganizationStepClient
                            accessToken={session.accessToken}
                            nextHref={nextHref}
                            initialOrgName={prefillOrgName}
                        />
                    </div>
                </div>
            </SlideLeftTransition>
        </>
    );
}

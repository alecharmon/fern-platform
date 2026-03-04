import { isSuperUser } from "@fern-api/user-permissions";
import { PopoverArrow } from "@radix-ui/react-popover";
import { BookOpen, ExternalLink, RotateCcw } from "lucide-react";
import { Suspense } from "react";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { OrgSwitcher } from "@/components/auth/OrgSwitcher";
import { HeaderLinkButton } from "@/components/layout/HeaderLinkButton";
import { MaybeDocsHeaderItems } from "@/components/layout/MaybeDocsHeaderItems";
import { ProfileImage } from "@/components/layout/ProfileImage";
import { SupportHeaderLink } from "@/components/layout/SupportHeaderLink";
import { HeaderBillingAlert } from "@/components/org-alert/HeaderBillingAlert";
import { getAllFeatureFlags } from "@/components/posthog/feature-flags/server-side";
import { SuperAdminDropdown } from "@/components/super-admin/SuperAdminDropdown";
import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DocsUrl } from "@/utils/types";

export default async function HeaderLayout({
    params
}: Readonly<{
    params: Promise<{ docsUrl?: DocsUrl; orgName?: Auth0OrgName }>;
}>) {
    const { orgName, docsUrl } = await params;
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    const { name, email, picture } = session.user;
    const showSuperAdmin = isSuperUser(session.permissions ?? []);

    // Fetch feature flags for super admin panel (only when user is a super user)
    const featureFlags = showSuperAdmin
        ? ((await getAllFeatureFlags(session.user.sub, orgName)) as Record<string, boolean | string>)
        : {};

    return (
        <div className="flex justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-4">
                <ThemedFernLogo className="w-16" />
                <Suspense fallback={<div className="h-[36px]" />}>
                    <OrgSwitcher currentOrgName={orgName} />
                </Suspense>
                <Suspense fallback={null}>
                    <MaybeDocsHeaderItems docsUrl={docsUrl} orgName={orgName} />
                </Suspense>
            </div>
            <div className="flex shrink-0 gap-2">
                <div className="hidden items-center md:flex">
                    {session.orgId && (
                        <Suspense fallback={null}>
                            <HeaderBillingAlert orgId={session.orgId} />
                        </Suspense>
                    )}
                    <SupportHeaderLink icon={false} />
                    {showSuperAdmin && <SuperAdminDropdown isSuperUser={showSuperAdmin} featureFlags={featureFlags} />}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost" className="w-8 justify-center px-0 has-[>svg]:px-0">
                                <BookOpen className="h-[1.2rem] w-[1.2rem]" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" collisionPadding={8} className="w-[200px] p-1">
                            <PopoverArrow className="fill-popover" />
                            <div className="flex flex-col">
                                <HeaderLinkButton
                                    text="Docs"
                                    className="justify-start px-2 text-left"
                                    href="https://buildwithfern.com/learn"
                                    rightIcon={<ExternalLink className="h-3 w-3" />}
                                />
                                <HeaderLinkButton
                                    text="Changelog"
                                    className="justify-start px-2 text-left"
                                    href="https://buildwithfern.com/learn/docs/getting-started/changelog"
                                    rightIcon={<ExternalLink className="h-3 w-3" />}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                    <ThemeToggle />
                </div>
                <Popover>
                    <PopoverTrigger className="cursor-pointer">
                        <ProfileImage picture={picture} name={name} />
                    </PopoverTrigger>
                    <PopoverContent collisionPadding={8} className="w-[200px]">
                        <PopoverArrow className="fill-popover" />
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col">
                                <div className="text-gray-1200 text-sm">{name}</div>
                                <div className="text-xs text-gray-800">{email}</div>
                            </div>
                            <div className="flex flex-col md:hidden">
                                <SupportHeaderLink
                                    className="justify-start text-left !px-0"
                                    buttonProps={{ variant: "ghost" }}
                                    icon={true}
                                />
                                <HeaderLinkButton
                                    text="Docs"
                                    className="justify-start text-left !px-0"
                                    href="https://buildwithfern.com/learn"
                                    icon={<BookOpen className="h-4 w-4" />}
                                />
                                <HeaderLinkButton
                                    text="Changelog"
                                    className="justify-start text-left !px-0"
                                    href="https://buildwithfern.com/learn/docs/getting-started/changelog"
                                    icon={<RotateCcw className="h-4 w-4" />}
                                />
                                <ThemeToggle showLabel />
                            </div>
                            <LogoutButton variant="default" />
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}

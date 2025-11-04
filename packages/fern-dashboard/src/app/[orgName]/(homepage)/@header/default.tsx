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
import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
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
    const { accessToken } = session;

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
                    <SupportHeaderLink icon={false} />
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="text-gray-1100 hover:text-gray-1200 flex h-8 w-8 cursor-pointer items-center justify-center transition-colors"
                            >
                                <BookOpen className="h-4 w-4" />
                            </button>
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
                                <ThemeToggle />
                            </div>
                            <LogoutButton variant="default" />
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}

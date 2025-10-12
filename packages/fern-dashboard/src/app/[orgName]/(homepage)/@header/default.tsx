import { PopoverArrow } from "@radix-ui/react-popover";
import { Book, RotateCcw } from "lucide-react";
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
                    <HeaderLinkButton text="Docs" href="https://buildwithfern.com/learn" />
                    <HeaderLinkButton
                        text="Changelog"
                        href="https://buildwithfern.com/learn/docs/getting-started/changelog"
                    />
                    <ThemeToggle />
                </div>
                <Popover>
                    <PopoverTrigger className="cursor-pointer">
                        <ProfileImage picture={picture} name={name} />
                    </PopoverTrigger>
                    <PopoverContent collisionPadding={8}>
                        <PopoverArrow className="fill-popover" />
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col">
                                <div className="text-gray-1200 text-sm">{name}</div>
                                <div className="text-xs text-gray-800">{email}</div>
                            </div>
                            <div className="flex flex-col md:hidden">
                                <SupportHeaderLink
                                    className="justify-start px-0 text-left hover:px-2 has-[>svg]:px-0 hover:has-[>svg]:px-2"
                                    buttonProps={{ variant: "ghost" }}
                                    icon={true}
                                />
                                <HeaderLinkButton
                                    text="Docs"
                                    className="justify-start px-0 text-left hover:px-2 has-[>svg]:px-0 hover:has-[>svg]:px-2"
                                    href="https://buildwithfern.com/learn"
                                    icon={<Book className="h-4 w-4" />}
                                />
                                <HeaderLinkButton
                                    text="Changelog"
                                    className="justify-start px-0 text-left hover:px-2 has-[>svg]:px-0 hover:has-[>svg]:px-2"
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

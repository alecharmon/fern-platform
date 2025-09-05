import { PopoverArrow } from "@radix-ui/react-popover";
import { Book, RotateCcw } from "lucide-react";

import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { LogoutButton } from "../auth/LogoutButton";
import { OrgSwitcher } from "../auth/OrgSwitcher";
import { ThemeToggle } from "../theme/ThemeToggle";
import { ThemedFernLogo } from "../theme/ThemedFernLogo";
import { HeaderLinkButton } from "./HeaderLinkButton";
import { MaybeDocsHeaderItems } from "./MaybeDocsHeaderItems";
import { ProfileImage } from "./ProfileImage";
import { SupportHeaderLink } from "./SupportHeaderLink";

export declare namespace Header {
  export interface Props {
    session: Auth0SessionData;
  }
}

export async function Header({ session }: Header.Props) {
  const { name, email, picture } = session.user;

  return (
    <div className="flex justify-between gap-4 p-4">
      <div className="flex min-w-0 items-center gap-4">
        <ThemedFernLogo className="w-16" />
        <OrgSwitcher />
        <MaybeDocsHeaderItems />
      </div>
      <div className="flex shrink-0 gap-2">
        <div className="hidden items-center md:flex">
          <SupportHeaderLink icon={false} />
          <HeaderLinkButton
            text="Docs"
            href="https://buildwithfern.com/learn"
          />
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

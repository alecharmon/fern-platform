"use client";

import { MessageCircleQuestion } from "lucide-react";

import { getPylon } from "../pylon/getPylon";
import { HeaderLinkButton } from "./HeaderLinkButton";

export declare namespace SupportHeaderLink {
  export interface Props {
    className?: string;
    buttonProps?: React.ComponentProps<typeof HeaderLinkButton> extends infer T
      ? T extends { buttonProps?: infer B }
        ? B
        : never
      : never;
    icon?: boolean;
  }
}

export function SupportHeaderLink({
  className,
  buttonProps,
  icon,
}: SupportHeaderLink.Props) {
  const openSupport = () => {
    getPylon()?.("show");
    getPylon()?.("showChatBubble");
  };

  return (
    <HeaderLinkButton
      text="Support"
      href="#"
      className={className}
      icon={icon && <MessageCircleQuestion className="h-4 w-4" />}
      buttonProps={buttonProps}
      onClick={openSupport}
    />
  );
}

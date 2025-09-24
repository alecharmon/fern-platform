import React, { ElementType } from "react";

import { LockClosedIcon } from "@heroicons/react/24/outline";

import { LogoutButton } from "../auth/LogoutButton";

export default function NotFoundContent({
  children,
  icon = LockClosedIcon,
  hideFooter = false,
}: {
  children: React.ReactNode;
  hideFooter?: boolean;
  icon?: ElementType;
}) {
  const Icon = React.createElement(icon, {
    className: "size-18 text-gray-500",
  });
  return (
    <div className="mx-auto flex w-[550px] flex-col items-center justify-center gap-8">
      {Icon}

      <div className="max- flex flex-col text-center">
        <div className="mb-2 text-2xl font-bold">{children}</div>
      </div>

      {!hideFooter && (
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm">
            Want to try logging in as a different user?
          </p>
          <LogoutButton />
        </div>
      )}
    </div>
  );
}

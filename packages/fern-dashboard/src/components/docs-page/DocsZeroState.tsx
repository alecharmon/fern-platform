import { User } from "@auth0/nextjs-auth0/types";
import { PlusIcon } from "lucide-react";

import { Button } from "../ui/button";
import { DocsZeroStateImage } from "./DocsZeroStateImage";

export declare namespace DocsZeroState {
  export interface Props {
    user: User;
  }
}

export async function DocsZeroState({ user }: DocsZeroState.Props) {
  let welcomeString = "Welcome";
  const firstName = getFirstName(user);
  if (firstName != null) {
    welcomeString += ", " + firstName;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-xl font-bold">{welcomeString}</div>
      <div className="mt-2 text-sm text-gray-900">
        Delight your developers with gorgeous Docs.
      </div>
      <div className="mt-12">
        <div className="flex flex-col gap-4">
          <DocsZeroStateImage />
          <div className="flex justify-center">
            <Button variant="default" asChild>
              <a
                href="https://buildwithfern.com/learn/docs/getting-started/quickstart"
                target="_blank"
                className="flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Create your first Docs site
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getFirstName(user: User) {
  if (user.given_name != null) {
    return user.given_name;
  }
  if (user.name != null) {
    return user.name.split(" ")[0];
  }
  return undefined;
}

import { Button } from "../ui/button";
import { GithubLogo } from "./GithubLogo";

export const LoginButton = ({
  returnTo,
  additionalParams,
  buttonProps,
  children,
}: {
  returnTo?: string;
  additionalParams?: Record<string, string>;
  buttonProps?: React.ComponentProps<typeof Button>;
  children?: React.ReactNode;
}) => {
  return (
    <Button {...buttonProps} asChild>
      <a
        href={getLoginUrl({ connection: "github", returnTo, additionalParams })}
      >
        {children ?? (
          <>
            <GithubLogo />
            Continue with Github
          </>
        )}
      </a>
    </Button>
  );
};

function getLoginUrl({
  connection,
  returnTo,
  additionalParams,
}: {
  connection: string;
  returnTo?: string;
  additionalParams?: Record<string, string>;
}) {
  const searchParams = new URLSearchParams(additionalParams);
  if (returnTo != null) {
    searchParams.append("returnTo", returnTo);
  }
  searchParams.append("connection", connection);
  return `/auth/login?${searchParams.toString()}`;
}

import { type VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "../ui/button";

export const LogoutButton = ({
  variant = "outline",
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) => {
  return (
    <Button variant={variant} asChild>
      <a href="/auth/logout">Logout</a>
    </Button>
  );
};

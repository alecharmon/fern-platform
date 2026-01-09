import type { VariantProps } from "class-variance-authority";

import { Button, type buttonVariants } from "../ui/button";

export const LogoutButton = ({
    variant = "outline",
    className
}: {
    variant?: VariantProps<typeof buttonVariants>["variant"];
    className?: string;
}) => {
    return (
        <Button variant={variant} asChild className={className}>
            <a href="/api/logout">Logout</a>
        </Button>
    );
};

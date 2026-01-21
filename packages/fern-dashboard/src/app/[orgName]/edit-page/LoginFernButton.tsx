"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface LoginFernButtonProps {
    loginUrl: string;
}

export function LoginFernButton({ loginUrl }: LoginFernButtonProps) {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);

    const handleClick = () => {
        setIsPending(true);
        router.push(loginUrl);
    };

    return (
        <Button onClick={handleClick} disabled={isPending} className="w-full">
            {isPending ? (
                <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Logging in...
                </>
            ) : (
                "Log in to Fern"
            )}
        </Button>
    );
}

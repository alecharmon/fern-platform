import UserIcon from "@heroicons/react/24/outline/UserIcon";
import Image from "next/image";

import { cn } from "@/utils/utils";

export function ProfileImage({ picture, name, className }: { picture?: string; name?: string; className?: string }) {
    return (
        <>
            {picture != null ? (
                <Image
                    src={picture}
                    alt={name ?? "user photo"}
                    className={cn("rounded-full", className)}
                    width={32}
                    height={32}
                />
            ) : (
                <div className={cn("bg-gray-1200 border-border size-8 rounded-full border p-1", className)}>
                    <UserIcon className="size-full text-white" />
                </div>
            )}
        </>
    );
}

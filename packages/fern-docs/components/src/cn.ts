import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// todo(cd): improve mergine behavior for multiple tailwind sources
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

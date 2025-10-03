"use client";

import Link from "next/link";

import { Button } from "./ui/button";

export default function ReturnHomeButton() {
    return (
        <Button asChild>
            <Link href="/">Return home</Link>
        </Button>
    );
}

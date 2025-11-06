import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";

export function DocsZeroStateButton() {
    return (
        <Button variant="default" asChild>
            <Link
                href="https://buildwithfern.com/learn/docs/getting-started/quickstart"
                target="_blank"
                className="flex items-center gap-2"
                rel="noopener"
            >
                <PlusIcon className="h-4 w-4" />
                Create your first docs site
            </Link>
        </Button>
    );
}

import Link from "next/link";

import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { SlideUpTransition } from "@/components/transitions/SlideUpTransition";
import { getCurrentSession } from "../../services/auth0/getCurrentSession";
import { redirectToLogin } from "../../services/auth0/redirectToLogin";
import { ProductCard } from "./ProductCard";

export default async function GetStartedCardSlot() {
    const session = await getCurrentSession();
    if (session == null) {
        return await redirectToLogin();
    }

    return (
        <>
            <SlideLeftTransition>
                <div className="flex w-full flex-col max-w-[500px]">
                    <h1 className="text-2xl font-bold">Where do you want to start?</h1>
                    <div className="flex gap-4 mt-8">
                        <ProductCard variant="docs" />
                        <ProductCard variant="sdk" />
                    </div>
                </div>
            </SlideLeftTransition>
            <div className="absolute bottom-16">
                <SlideUpTransition>
                    <p className="text-sm text-muted-foreground">
                        Looking for an existing Fern organization?{" "}
                        <Link href="/get-started/search" className="fern-link">
                            Find it →
                        </Link>
                    </p>
                </SlideUpTransition>
            </div>
        </>
    );
}

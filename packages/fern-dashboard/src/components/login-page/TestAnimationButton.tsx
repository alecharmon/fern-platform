"use client";

import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

/**
 * Temporary test button to simulate login -> get-started animation flow.
 * Add this to LoginPage to test the transition animation.
 *
 * Usage in LoginPage:
 * import { TestAnimationButton } from "./TestAnimationButton";
 *
 * Then add <TestAnimationButton /> anywhere in the cardContent
 */
export const TestAnimationButton = () => {
    const router = useRouter();

    const handleTestAnimation = () => {
        // Simulate the login -> get-started redirect
        router.push("/get-started");
    };

    return (
        <div className="mt-4">
            <Button
                onClick={handleTestAnimation}
                variant="outline"
                className="w-full border-dashed border-orange-500 text-orange-600 hover:bg-orange-50"
            >
                🎬 Test Animation (Navigate to Get Started)
            </Button>
        </div>
    );
};

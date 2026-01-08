import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { BackArrow } from "../BackArrow";

export default function Page() {
    return (
        <>
            <BackArrow href="/get-started" />
            <SlideLeftTransition>
                <div className="flex h-full flex-col gap-2 max-w-[400px]">
                    <h1 className="text-2xl font-semibold">Book a demo</h1>
                    <p className="text-sm text-muted-foreground mb-6">
                        A Fern expert will guide you through how to generate idiomatic SDKs based on your API.
                    </p>
                    <iframe
                        src="https://calendly.com/chris-fern/demo-with-fern-clone?hide_event_type_details=1"
                        width="400px"
                        height="600px"
                        className="border-0 outline outline-border rounded-xl"
                        title="Book a demo"
                    />
                </div>
            </SlideLeftTransition>
        </>
    );
}

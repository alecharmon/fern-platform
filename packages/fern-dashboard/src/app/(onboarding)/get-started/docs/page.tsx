import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { BackArrow } from "../BackArrow";

export default function Page() {
    return (
        <>
            <BackArrow href="/get-started" />
            <SlideLeftTransition>
                <div className="h-full">DOCS</div>
            </SlideLeftTransition>
        </>
    );
}

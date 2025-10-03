import { FaIcon } from "./fa-icon";

interface GradientExclamationProps {
    colors?: [string, string, string];
}

export default function GradientExclamation({
    colors = ["var(--grayscale-a4)", "var(--grayscale-a6)", "var(--grayscale-a11)"]
}: GradientExclamationProps) {
    return (
        <FaIcon
            icon="fa-solid fa-triangle-exclamation"
            className="h-[96px] w-[96px]"
            strokeWidth={4}
            fill="url(#404-background)"
            stroke="url(#404-border)"
            gradients={[
                {
                    id: "404-background",
                    stops: [
                        { offset: "0%", color: colors[0] },
                        { offset: "100%", color: colors[1] }
                    ]
                },
                {
                    id: "404-border",
                    stops: [
                        { offset: "0%", color: colors[1] },
                        { offset: "100%", color: colors[2] }
                    ]
                }
            ]}
        />
    );
}

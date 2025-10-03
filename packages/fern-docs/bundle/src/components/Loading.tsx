import { cn } from "@fern-docs/components";

interface LoadingProps {
    className?: string;
    text?: string;
    size?: "sm" | "md" | "lg";
}

export const Loading = ({ className, text = "Loading..." }: LoadingProps) => {
    return (
        <div className={cn("flex items-center justify-center", className)}>
            <div className="flex flex-row items-center justify-center gap-4">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                    <circle
                        stroke="#4b5563"
                        stroke-width="3"
                        stroke-linecap="round"
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                    />

                    <circle cx="12" cy="3" r="2" fill="#e5e7eb">
                        <animateTransform
                            attributeName="transform"
                            attributeType="XML"
                            type="rotate"
                            values="90 12 12; 270 12 12; 90 12 12"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    </circle>

                    <circle cx="12" cy="3" r="2" fill="#e5e7eb">
                        <animateTransform
                            attributeName="transform"
                            attributeType="XML"
                            type="rotate"
                            values="90 12 12; -90 12 12; 90 12 12"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    </circle>
                </svg>
                <div className="font-medium">{text}</div>
            </div>
        </div>
    );
};

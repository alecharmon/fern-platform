/** Renders text with each character scaling up and fading in with a staggered delay */
export function AnimatedText({ text, className }: { text: string; className?: string }) {
    return (
        <span className={className}>
            {text.split("").map((char, index) => (
                <span
                    key={`${index}-${char}`}
                    className="inline-block animate-scale-fade-in"
                    style={{
                        animationDelay: `${index * 20}ms`,
                        animationFillMode: "both"
                    }}
                >
                    {char === " " ? "\u00A0" : char}
                </span>
            ))}
        </span>
    );
}

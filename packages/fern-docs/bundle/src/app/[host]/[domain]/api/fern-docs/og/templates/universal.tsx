import type { OgTemplateData } from "./types";

function truncateText(text: string, maxLen: number): string {
    if (text.length <= maxLen) {
        return text;
    }
    return text.slice(0, maxLen - 1) + "\u2026";
}

const Logo = ({ src }: { src: string }) => (
    // biome-ignore lint/performance/noImgElement: Satori does not support next/image
    <img src={src} height={40} alt="" style={{ maxHeight: 40, maxWidth: 200 }} />
);

export function UniversalTemplate(data: OgTemplateData): React.ReactElement {
    const {
        title,
        domain,
        logoSrc,
        backgroundColor,
        backgroundImageSrc,
        textColor,
        headingFontFamily,
        bodyFontFamily
    } = data;

    const containerStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "60px 80px",
        color: textColor,
        backgroundColor,
        position: "relative" as const
    };

    if (backgroundImageSrc) {
        containerStyle.backgroundImage = `url(${backgroundImageSrc})`;
        containerStyle.backgroundSize = "cover";
        containerStyle.backgroundPosition = "center";
    }

    return (
        <div style={containerStyle}>
            {/* Top section: title */}
            <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
                <div
                    style={{
                        fontSize: 56,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        letterSpacing: "-0.02em",
                        ...(headingFontFamily ? { fontFamily: headingFontFamily } : {})
                    }}
                >
                    {truncateText(title, 80)}
                </div>
            </div>

            {/* Bottom section: logo (left) + domain (right) */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    width: "100%"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", height: 40 }}>
                    {logoSrc ? <Logo src={logoSrc} /> : null}
                </div>

                <div
                    style={{
                        fontSize: 20,
                        fontWeight: 400,
                        opacity: 0.7,
                        ...(bodyFontFamily ? { fontFamily: bodyFontFamily } : {})
                    }}
                >
                    {domain}
                </div>
            </div>
        </div>
    );
}

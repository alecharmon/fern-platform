import {
    A4_PAGE_SIZE_PT,
    HEADER_FOOTER_FONT_SIZE_PT,
    HEADER_FOOTER_INSET_PT,
    HEADER_FOOTER_TEXT_COLOR_RGB
} from "@fern-api/docs-pdf";

const TEXT_COLOR = `rgb(${HEADER_FOOTER_TEXT_COLOR_RGB.r}, ${HEADER_FOOTER_TEXT_COLOR_RGB.g}, ${HEADER_FOOTER_TEXT_COLOR_RGB.b})`;

const FONT_STYLE: React.CSSProperties = {
    fontSize: HEADER_FOOTER_FONT_SIZE_PT,
    fontFamily: "Helvetica, Arial, sans-serif",
    color: TEXT_COLOR,
    lineHeight: "normal"
};

const SKELETON_LINES: readonly { width: string; height: number; gap: number }[] = [
    { width: "55%", height: 18, gap: 0 },
    { width: "40%", height: 10, gap: 10 },
    { width: "90%", height: 6, gap: 28 },
    { width: "100%", height: 6, gap: 7 },
    { width: "75%", height: 6, gap: 7 },

    { width: "35%", height: 14, gap: 28 },
    { width: "95%", height: 6, gap: 14 },
    { width: "80%", height: 6, gap: 7 },
    { width: "100%", height: 6, gap: 7 },
    { width: "70%", height: 6, gap: 7 },

    { width: "35%", height: 14, gap: 28 },
    { width: "95%", height: 6, gap: 14 },
    { width: "80%", height: 6, gap: 7 },
    { width: "100%", height: 6, gap: 7 },
    { width: "70%", height: 6, gap: 7 },

    { width: "35%", height: 14, gap: 28 },
    { width: "95%", height: 6, gap: 14 },
    { width: "80%", height: 6, gap: 7 },
    { width: "100%", height: 6, gap: 7 },
    { width: "70%", height: 6, gap: 7 },

    { width: "35%", height: 14, gap: 28 },
    { width: "95%", height: 6, gap: 14 },
    { width: "80%", height: 6, gap: 7 },
    { width: "100%", height: 6, gap: 7 },
    { width: "70%", height: 6, gap: 7 },

    { width: "35%", height: 14, gap: 28 },
    { width: "95%", height: 6, gap: 14 },
    { width: "80%", height: 6, gap: 7 },
    { width: "100%", height: 6, gap: 7 },
    { width: "70%", height: 6, gap: 7 },

    { width: "35%", height: 14, gap: 28 },
    { width: "95%", height: 6, gap: 14 },
    { width: "80%", height: 6, gap: 7 },
    { width: "100%", height: 6, gap: 7 },
    { width: "70%", height: 6, gap: 7 }
];

export interface PdfContentPagePreviewProps {
    headerLeft: string | undefined;
    headerRight: string | undefined;
    footerLeft: string | undefined;
    footerRight: string | undefined;
}

export function PdfContentPagePreview({
    headerLeft,
    headerRight,
    footerLeft,
    footerRight
}: PdfContentPagePreviewProps) {
    const inset = HEADER_FOOTER_INSET_PT;

    return (
        <div className="relative" style={{ width: A4_PAGE_SIZE_PT.width, height: A4_PAGE_SIZE_PT.height }}>
            {/* Header */}
            <div
                className="absolute flex items-start justify-between"
                style={{ top: inset, left: inset, right: inset }}
            >
                {headerLeft ? (
                    <span className="whitespace-nowrap" style={FONT_STYLE}>
                        {headerLeft}
                    </span>
                ) : (
                    <span />
                )}
                {headerRight ? (
                    <span className="whitespace-nowrap text-right" style={FONT_STYLE}>
                        {headerRight}
                    </span>
                ) : (
                    <span />
                )}
            </div>

            {/* Content skeleton */}
            <div className="absolute flex flex-col" style={{ top: 72, left: 56, right: 56, bottom: 72 }}>
                {SKELETON_LINES.map((line, i) => (
                    <div
                        key={i}
                        className="rounded-sm"
                        style={{
                            height: line.height,
                            width: line.width,
                            marginTop: line.gap,
                            backgroundColor: line.height >= 14 ? "#d1d5db" : "#e5e7eb"
                        }}
                    />
                ))}
            </div>

            {/* Footer */}
            <div
                className="absolute flex items-end justify-between"
                style={{ bottom: inset, left: inset, right: inset }}
            >
                {footerLeft ? (
                    <span className="whitespace-nowrap" style={FONT_STYLE}>
                        {footerLeft}
                    </span>
                ) : (
                    <span />
                )}
                {footerRight ? (
                    <span className="whitespace-nowrap text-right" style={FONT_STYLE}>
                        {footerRight}
                    </span>
                ) : (
                    <span />
                )}
            </div>
        </div>
    );
}

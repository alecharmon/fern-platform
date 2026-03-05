import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function createStubContentPagePdf(title: string | undefined, slug: string): Promise<PDFDocument> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Standard A4 in points: 595.28 × 841.89
    const page = pdf.addPage([595.28, 841.89]);

    const displayTitle = title ?? "Untitled";
    const titleFontSize = 18;
    const slugFontSize = 11;
    const labelFontSize = 9;
    const gray = rgb(0.6, 0.6, 0.6);
    const lightGray = rgb(0.85, 0.85, 0.85);

    const { width, height } = page.getSize();
    const cx = width / 2;
    const cy = height / 2;

    // Draw a centered "[STUB]" label so it's visually obvious
    const stubLabel = "[STUB PAGE]";
    const stubLabelWidth = font.widthOfTextAtSize(stubLabel, labelFontSize);
    page.drawText(stubLabel, {
        x: cx - stubLabelWidth / 2,
        y: cy + 40,
        size: labelFontSize,
        font,
        color: lightGray
    });

    // Draw the title
    const titleWidth = boldFont.widthOfTextAtSize(displayTitle, titleFontSize);
    page.drawText(displayTitle, {
        x: Math.max(40, cx - titleWidth / 2),
        y: cy + 10,
        size: titleFontSize,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: width - 80
    });

    // Draw the slug below the title
    const slugWidth = font.widthOfTextAtSize(slug, slugFontSize);
    page.drawText(slug, {
        x: Math.max(40, cx - slugWidth / 2),
        y: cy - 15,
        size: slugFontSize,
        font,
        color: gray,
        maxWidth: width - 80
    });

    return pdf;
}

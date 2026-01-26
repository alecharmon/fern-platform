import { PDFDocument } from "pdf-lib";

export async function mergePdfDocuments(...documents: PDFDocument[]) {
    const mergedPdf = await PDFDocument.create();
    for (const document of documents) {
        const pages = await mergedPdf.copyPages(document, document.getPageIndices());
        for (const page of pages) {
            mergedPdf.addPage(page);
        }
    }
    return mergedPdf;
}

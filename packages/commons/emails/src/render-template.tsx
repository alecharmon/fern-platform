import { render, toPlainText } from "@react-email/render";
import PdfExportCompleteEmail, { pdfExportCompleteEmailSubject } from "../emails/pdf-export-complete";
import type { EmailTemplate } from "./types";

interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}

export async function renderTemplate(template: EmailTemplate): Promise<RenderedEmail> {
    const { element, subject } = getTemplateJSXAndSubject(template);
    const html = await render(element, { pretty: true });
    const text = toPlainText(html);
    return {
        subject,
        html,
        text
    };
}

export function getTemplateJSXAndSubject(template: EmailTemplate): { element: React.JSX.Element; subject: string } {
    switch (template.type) {
        case "pdf-export-complete":
            return {
                element: PdfExportCompleteEmail(template.props),
                subject: pdfExportCompleteEmailSubject(template.props)
            };
    }
}

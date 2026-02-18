import type { PdfExportCompleteEmailProps } from "../emails/pdf-export-complete";

export type { PdfExportCompleteEmailProps } from "../emails/pdf-export-complete";

export interface PdfExportCompleteEmailTemplate {
    type: "pdf-export-complete";
    props: PdfExportCompleteEmailProps;
}

export type EmailTemplate = PdfExportCompleteEmailTemplate;

export interface SendEmailOptions {
    /** Recipient email address(es). */
    to: string | string[];
    /** The email template to render. */
    template: EmailTemplate;
    /** Sender email address. Defaults to the client's configured `from` address. */
    from?: string;
    /** Reply-to email address(es). */
    replyTo?: string | string[];
}

export interface SendEmailResult {
    /** The Resend email ID. */
    emailId: string;
}

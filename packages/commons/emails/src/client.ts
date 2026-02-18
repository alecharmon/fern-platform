import { Resend } from "resend";
import { renderTemplate } from "./render-template";
import type { SendEmailOptions, SendEmailResult } from "./types";

export interface FernEmailClientConfig {
    resendApiKey: string;

    /**
     * Default sender email address. Use the format "Fern <no-reply@updates.buildwithfern.com>"
     * to display "Fern" as the sender name.
     *
     * @remarks
     * For transactional emails, we currently support only `updates.buildwithfern.com` as the domain.
     * This address will be used as the default "from" field when sending emails unless overridden
     * in the individual `sendEmail` call.
     */
    fromEmailAddress: string;
}

/**
 * Email client for sending transactional emails for Fern.
 */
export class FernEmailClient {
    private readonly options: FernEmailClientConfig;
    private readonly resend: Resend;

    public constructor(options: FernEmailClientConfig) {
        this.options = options;
        this.resend = new Resend(options.resendApiKey);
    }

    public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
        const { subject, html, text } = await renderTemplate(options.template);

        const { data, error } = await this.resend.emails.send({
            from: options.from ?? this.options.fromEmailAddress,
            to: options.to,
            subject,
            html,
            text,
            replyTo: options.replyTo
        });

        if (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }

        if (!data) {
            throw new Error("Failed to send email: no data returned from Resend");
        }

        return { emailId: data.id };
    }
}

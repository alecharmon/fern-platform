import { FernEmailClient } from "../src/client";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.argv[2];

async function main(): Promise<void> {
    if (!RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY environment variable is required");
    }

    if (!TO_EMAIL) {
        throw new Error("Usage: pnpm send-test-email <recipient-email>");
    }

    const client = new FernEmailClient({
        resendApiKey: RESEND_API_KEY,
        fromEmailAddress: "Fern <no-reply@updates.buildwithfern.com>"
    });

    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log(`Sending test email to ${TO_EMAIL}...`);

    const result = await client.sendEmail({
        to: TO_EMAIL,
        template: {
            type: "pdf-export-complete",
            props: {
                userFirstName: "John",
                docsSiteUrl: "acme.docs.buildwithfern.com",
                exportTimestamp: new Date("2026-02-14T13:05:00Z"),
                downloadUrl: "https://example.com/test-download.pdf",
                downloadUrlExpiresInHours: 12
            }
        }
    });

    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log(`Email sent successfully! Resend ID: ${result.emailId}`);
}

void main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        // biome-ignore lint/suspicious/noConsole: CLI script output
        console.error("Failed to send test email:", error);
        process.exit(1);
    });

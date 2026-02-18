import { Link, Section } from "@react-email/components";
import { EmailButton, EmailHeading, EmailLayout, EmailText } from "../src/components";

export interface PdfExportCompleteEmailProps {
    /** Name of the user who requested the export. */
    userFirstName: string;
    /** The docs site URL (e.g. "acme.docs.buildwithfern.com"). */
    docsSiteUrl: string;
    /** Timestamp of the export. */
    exportTimestamp?: Date;
    /** Pre-signed URL to download the exported PDF. */
    downloadUrl: string;
    /** Number of hours until the download URL expires. */
    downloadUrlExpiresInHours: number;
}

export function pdfExportCompleteEmailSubject(_props: PdfExportCompleteEmailProps): string {
    return "Your PDF export is ready";
}

export default function PdfExportCompleteEmail({
    userFirstName,
    docsSiteUrl,
    exportTimestamp,
    downloadUrl,
    downloadUrlExpiresInHours
}: PdfExportCompleteEmailProps): React.JSX.Element {
    const exportTimestampFormatted =
        exportTimestamp != null
            ? new Date(exportTimestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "UTC",
                  timeZoneName: "short"
              })
            : undefined;

    return (
        <EmailLayout preview={`Your export of ${docsSiteUrl} is ready to download.`}>
            <EmailHeading>Your PDF export is ready</EmailHeading>

            <EmailText>Hi {userFirstName},</EmailText>

            <EmailText>
                Your export of {docsSiteUrl} {exportTimestampFormatted != null && `at ${exportTimestampFormatted} `}
                is ready to download.
            </EmailText>

            <Section className="my-6">
                <EmailButton href={downloadUrl}>Download</EmailButton>
            </Section>

            <EmailText>
                Or copy and paste this URL into your browser:
                <br />
                <Link className="break-all text-email-text underline" href={downloadUrl}>
                    {downloadUrl}
                </Link>
            </EmailText>

            <EmailText>
                This download link will expire in{" "}
                {downloadUrlExpiresInHours === 1 ? "1 hour" : `${downloadUrlExpiresInHours} hours`}.
            </EmailText>
        </EmailLayout>
    );
}

PdfExportCompleteEmail.PreviewProps = {
    userFirstName: "John",
    docsSiteUrl: "acme.docs.buildwithfern.com",
    exportTimestamp: new Date("2026-02-14T13:05:00Z"),
    downloadUrl: "https://example.com/test-download.pdf",
    downloadUrlExpiresInHours: 12
} satisfies PdfExportCompleteEmailProps;

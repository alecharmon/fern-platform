import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import { COMPANY_ADDRESS, COMPANY_NAME_FULL, CONTACT_EMAIL_ADDRESS, LOGO_URL } from "../constants";
import { tailwindConfig } from "./styles";

interface EmailLayoutProps {
    preview: string;
    children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps): React.JSX.Element {
    return (
        <Html>
            <Head>
                <meta name="color-scheme" content="light" />
                <meta name="supported-color-schemes" content="light" />
                <style>
                    {`
                    :root {
                        color-scheme: light !important;
                    }
                    [data-ogsc] {
                        color-scheme: light !important;
                    }
                    @media (prefers-color-scheme: dark) {
                        body {
                        background-color: #ffffff !important;
                        }
                    }`}
                </style>
            </Head>
            <Preview>{preview}</Preview>
            <Tailwind config={tailwindConfig}>
                <Body className="m-0 bg-white p-0 font-sans">
                    <Container className="mx-auto max-w-[560px] px-6 py-10">
                        {/* Logo */}
                        <Section className="mb-6">
                            <Img src={LOGO_URL} alt="Fern" height="22" className="block" />
                        </Section>

                        {/* Content */}
                        {children}

                        {/* Footer */}
                        <Hr className="mb-6 mt-8 border-email-border" />
                        <Text className="m-0 mb-1 font-sans text-xs leading-relaxed text-email-muted">
                            Copyright &copy; {new Date().getFullYear()} {COMPANY_NAME_FULL}. All rights reserved.
                        </Text>
                        <Text className="m-0 mb-1 font-sans text-xs leading-relaxed text-email-muted">
                            {COMPANY_ADDRESS}
                        </Text>
                        <Text className="m-0 mb-1 font-sans text-xs leading-relaxed text-email-muted">
                            If you did not request this download or have other questions,{" "}
                            <Link href={`mailto:${CONTACT_EMAIL_ADDRESS}`} className="text-email-muted underline">
                                contact us.
                            </Link>
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}

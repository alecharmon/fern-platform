import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { AuthPageCard } from "@/components/login-page/AuthPageCard";

interface SignUpPageProps {
    searchParams: Promise<{ redirect_on_login?: string }>;
}

export default async function SignUpCardSlot({ searchParams }: SignUpPageProps) {
    const session = await getCurrentSession();

    if (session != null) {
        redirect("/");
    }

    return (
        <AuthPageCard
            searchParams={searchParams}
            headerText="Create a Fern account"
            subtitle="Get started for free, no credit card required."
            buttonLabelPrefix="Sign up with"
            showEmailForm={false}
            buttonVariant="default"
            belowFormText="Already have an account?"
            belowFormLinkText="Log in"
            belowFormLinkHref="/login"
        />
    );
}

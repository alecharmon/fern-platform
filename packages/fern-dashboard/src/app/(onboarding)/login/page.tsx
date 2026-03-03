import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { AuthPageCard } from "@/components/login-page/AuthPageCard";

interface LoginPageProps {
    searchParams: Promise<{ redirect_on_login?: string }>;
}

export default async function LoginCardSlot({ searchParams }: LoginPageProps) {
    const session = await getCurrentSession();

    if (session != null) {
        redirect("/");
    }

    return (
        <AuthPageCard
            searchParams={searchParams}
            headerText="Welcome back to Fern"
            buttonLabelPrefix="Continue with"
            emailSubmitLabel="Log in"
            belowFormText="Don't have an account?"
            belowFormLinkText="Sign up"
            belowFormLinkHref="/sign-up"
        />
    );
}

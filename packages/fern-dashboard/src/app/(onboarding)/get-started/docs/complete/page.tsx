import { redirect } from "next/navigation";

export default function LegacyDocsCompleteRedirect() {
    redirect("/get-started/create-org");
}

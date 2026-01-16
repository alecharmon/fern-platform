import { redirect } from "next/navigation";

export default function LegacyDocsPublishingRedirect() {
    redirect("/get-started/create-org");
}

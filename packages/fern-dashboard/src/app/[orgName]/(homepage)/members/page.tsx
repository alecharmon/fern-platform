import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { MembersPage } from "@/components/members/MembersPage";

export default async function Page() {
  const session = await getCurrentSession();
  if (session == null) {
    redirect("/");
  }
  return <MembersPage session={session} />;
}

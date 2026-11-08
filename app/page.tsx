import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAdminSessionFromToken, sessionCookieName } from "@/lib/auth";
import Dashboard from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const cookieStore = await cookies();
    if (!getAdminSessionFromToken(cookieStore.get(sessionCookieName)?.value)) redirect("/login");
  } catch {
    redirect("/login");
  }

  return <Dashboard />;
}

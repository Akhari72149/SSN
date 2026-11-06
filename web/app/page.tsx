import DashboardClient from "./dashboard-client";
import { isLiveMode } from "@/lib/auth/config";
import { requirePageSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isLiveMode()) return <DashboardClient />;
  const session = await requirePageSession("/");
  return <DashboardClient viewerName={session.user.displayName} viewerRole="Authenticated user" synthetic={false} />;
}

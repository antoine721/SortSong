import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/session";
import { getConfig } from "@/lib/server/config";

export default async function Home() {
  if (!(await getConfig()).spotifyClientId) redirect("/setup");
  const user = await getUser().catch(() => null);
  redirect(user ? "/inbox" : "/login");
}

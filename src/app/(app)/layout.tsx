import { redirect } from "next/navigation";
import { getUserId } from "@/lib/server/session";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const id = await getUserId().catch(() => null);
  if (!id) redirect("/login");
  return <Shell>{children}</Shell>;
}

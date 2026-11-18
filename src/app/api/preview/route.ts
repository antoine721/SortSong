import { NextRequest } from "next/server";
import { handler, requireUser } from "@/lib/server/session";
import { previewFor } from "@/lib/server/mix";
import { pool } from "@/lib/server/match";

/** Extraits de 30 s pour une liste d'IDs Spotify (?ids=a,b,c), via le catalogue public Deezer. */
export const GET = handler(async (req: NextRequest) => {
  await requireUser();
  const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 10);
  const urls = await pool(ids, 4, (id) => previewFor(id).catch(() => null));
  return { previews: Object.fromEntries(ids.map((id, i) => [id, urls[i]])) };
});

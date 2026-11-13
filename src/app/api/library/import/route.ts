import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/server/session";
import { importLibrary } from "@/lib/server/library";

export const maxDuration = 600;

/** Import / resynchronisation, progression en NDJSON. */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (e) {
    return Response.json({ error: "Non connecté" }, { status: e instanceof HttpError ? e.status : 401 });
  }
  const { mode } = (await req.json().catch(() => ({}))) as { mode?: "full" | "sync" };
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const result = await importLibrary(userId, mode === "sync" ? "sync" : "full", (p) => send({ type: "progress", ...p }));
        send({ type: "done", ...result });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

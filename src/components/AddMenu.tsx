"use client";
import { Check, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { normText } from "@/lib/client/format";
import { Popover, cx } from "./ui";

/** C4 : liste à cocher des playlists ; celles qui contiennent déjà le morceau sont cochées. */
export function AddMenu() {
  const menu = useApp((s) => s.addMenu);
  const close = () => useApp.setState({ addMenu: null });
  if (!menu) return null;
  return (
    <Popover anchor={{ x: menu.x, y: menu.y }} onClose={close} width={300}>
      <AddMenuBody key={menu.track.id} />
    </Popover>
  );
}

function AddMenuBody() {
  const menu = useApp((s) => s.addMenu)!;
  const playlists = useApp((s) => s.playlists);
  const folders = useApp((s) => s.folders);
  const membership = useApp((s) => s.membership[menu.track.id]);
  const toggle = useApp((s) => s.togglePlaylist);
  const createPlaylist = useApp((s) => s.createPlaylist);
  const addTo = useApp((s) => s.addToPlaylists);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);

  const pathOf = (folderId: string | null) => {
    const parts: string[] = [];
    let cur = folderId;
    let guard = 0;
    while (cur && guard++ < 20) {
      const f = folders.find((x) => x.id === cur);
      if (!f) break;
      parts.unshift(f.name);
      cur = f.parentId;
    }
    return parts.join(" / ");
  };

  const items = useMemo(() => {
    const nq = normText(q);
    return playlists
      .filter((p) => !p.rules)
      .map((p) => ({ ...p, path: pathOf(p.folderId) }))
      .filter((p) => !nq || normText(p.name + " " + p.path).includes(nq))
      .sort((a, b) => {
        const am = membership?.includes(a.id) ? 0 : 1;
        const bm = membership?.includes(b.id) ? 0 : 1;
        if (!q && am !== bm) return am - bm;
        return (a.hotkey ?? 99) - (b.hotkey ?? 99) || a.path.localeCompare(b.path) || a.position - b.position;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, playlists, folders]);

  const create = async () => {
    const id = await createPlaylist({ name: q.trim() || "Nouvelle playlist" });
    await addTo(menu.track, [id]);
    setQ("");
  };

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, items.length));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (items[cursor]) toggle(menu.track, items[cursor].id);
          else create();
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-line px-2.5 pb-2 pt-1.5">
        <Search className="h-4 w-4 text-fg-3" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          placeholder="Ajouter à une playlist…"
          className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-3"
        />
      </div>
      <div className="max-h-[320px] overflow-y-auto py-1">
        {items.map((p, i) => {
          const checked = !!membership?.includes(p.id);
          return (
            <button
              key={p.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => toggle(menu.track, p.id)}
              className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left", cursor === i && "bg-bg-3")}
            >
              <span
                className={cx("grid h-4 w-4 shrink-0 place-items-center rounded border transition", checked ? "border-transparent" : "border-fg-3")}
                style={checked ? { background: p.color } : undefined}
              >
                {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.name}</span>
                {p.path && <span className="block truncate text-[11px] text-fg-3">{p.path}</span>}
              </span>
              {p.hotkey && <span className="rounded bg-bg-4 px-1.5 font-mono text-[10px] text-fg-2">{p.hotkey}</span>}
            </button>
          );
        })}
        {!items.length && !q && <div className="px-3 py-4 text-center text-sm text-fg-3">Aucune playlist pour l'instant</div>}
      </div>
      <button
        onMouseEnter={() => setCursor(items.length)}
        onClick={create}
        className={cx("flex w-full items-center gap-2 rounded-lg border-t border-line px-2.5 py-2 text-sm text-accent-2", cursor === items.length && "bg-bg-3")}
      >
        <Plus className="h-4 w-4" /> {q.trim() ? `Créer « ${q.trim()} »` : "Nouvelle playlist"}
      </button>
    </div>
  );
}

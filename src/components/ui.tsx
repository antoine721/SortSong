"use client";
import clsx from "clsx";
import { Music2 } from "lucide-react";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const cx = clsx;

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-9 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-[15px]",
        variant === "primary" && "bg-accent text-white shadow-[0_6px_24px_-6px_rgba(124,92,255,0.7)] hover:bg-accent-2",
        variant === "secondary" && "bg-bg-3 text-fg hover:bg-bg-4",
        variant === "ghost" && "text-fg-2 hover:bg-bg-3 hover:text-fg",
        variant === "danger" && "bg-red-500/15 text-red-300 hover:bg-red-500/25",
        className,
      )}
    />
  );
}

export const IconButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; size?: "sm" | "md" }>(
  function IconButton({ className, active, size = "md", ...p }, ref) {
    return (
      <button
        ref={ref}
        {...p}
        className={cx(
          "inline-grid shrink-0 place-items-center rounded-full transition disabled:opacity-30",
          size === "sm" ? "h-7 w-7" : "h-9 w-9",
          active ? "text-accent-2 hover:bg-bg-3" : "text-fg-2 hover:bg-bg-3 hover:text-fg",
          className,
        )}
      />
    );
  },
);

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-fg-3 border-t-accent", className)} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-fg-2 hover:text-fg">
      <span
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={cx("relative h-5 w-9 rounded-full transition", checked ? "bg-accent" : "bg-bg-4")}
      >
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label && <span onClick={() => onChange(!checked)}>{label}</span>}
    </label>
  );
}

export function Cover({ src, size = 48, className, rounded = "rounded-md" }: { src?: string | null; size?: number; className?: string; rounded?: string }) {
  const [err, setErr] = useState(false);
  return (
    <div className={cx("relative shrink-0 overflow-hidden bg-bg-3", rounded, className)} style={{ width: size, height: size }}>
      {src && !err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setErr(true)} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="grid h-full w-full place-items-center text-fg-3">
          <Music2 style={{ width: size * 0.4, height: size * 0.4 }} />
        </div>
      )}
    </div>
  );
}

/** Popover positionné (portail) avec fermeture au clic extérieur / Échap. */
export function Popover({
  anchor,
  onClose,
  children,
  width = 280,
  className,
  align = "end",
}: {
  anchor: { x: number; y: number } | DOMRect;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  className?: string;
  align?: "start" | "end";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const a = anchor as any;
    const ax = "left" in a ? (align === "end" ? a.right : a.left) : a.x;
    const ay = "bottom" in a ? a.bottom : a.y;
    const topIfBelow = ay + 6;
    let left = align === "end" ? ax - width : ax;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = topIfBelow;
    if (top + h > window.innerHeight - 8) top = Math.max(8, ("top" in a ? a.top : ay) - h - 6);
    setPos({ left, top });
  }, [anchor, width, align]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      className={cx("fadein fixed z-50 rounded-xl border border-line bg-bg-2 p-1 shadow-soft", className)}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  right,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
        danger ? "text-red-300 hover:bg-red-500/10" : "text-fg hover:bg-bg-3",
      )}
    >
      {icon && <span className="text-fg-2 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right}
    </button>
  );
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-bg-2 text-fg-3 [&>svg]:h-7 [&>svg]:w-7">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-fg-2">{children}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-bg-3 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">{children}</kbd>;
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
        active ? "border-transparent bg-fg text-bg" : "border-line bg-bg-2 text-fg-2 hover:border-fg-3 hover:text-fg",
      )}
      style={active && color ? { background: color, color: "#fff" } : undefined}
    >
      {children}
    </button>
  );
}

export function InlineEdit({
  value,
  onSave,
  className,
  placeholder,
  multiline,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (!editing)
    return (
      <span onClick={() => setEditing(true)} className={cx("cursor-text rounded hover:bg-white/5", !value && "text-fg-3", className)} title="Cliquer pour modifier">
        {value || placeholder}
      </span>
    );
  const commit = () => {
    setEditing(false);
    if (v !== value) onSave(v);
  };
  const props = {
    autoFocus: true,
    value: v,
    onChange: (e: any) => setV(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        setV(value);
        setEditing(false);
      }
    },
    placeholder,
    className: cx("w-full rounded bg-bg-3 px-1 outline-none ring-1 ring-accent", className),
  };
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
}

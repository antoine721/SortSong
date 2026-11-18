"use client";
import { Star } from "lucide-react";
import { useState } from "react";
import { cx } from "./ui";

/** Étoiles de 1 à 5 (lecture seule si pas de onChange). Re-cliquer la valeur actuelle l'efface. */
export function Stars({
  value,
  onChange,
  size = 16,
  className,
  color = "#fbbf24",
  empty = "rgba(255,255,255,0.18)",
}: {
  value: number | null | undefined;
  onChange?: (v: number | null) => void;
  size?: number;
  className?: string;
  color?: string;
  empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <span className={cx("inline-flex items-center", onChange ? "gap-1" : "gap-0.5", className)} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown;
        const icon = <Star style={{ width: size, height: size, color: on ? color : empty, fill: on ? color : "transparent" }} strokeWidth={1.8} />;
        return onChange ? (
          <button
            key={n}
            type="button"
            title={`${n} étoile${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? null : n)}
            className="transition hover:scale-110"
          >
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}

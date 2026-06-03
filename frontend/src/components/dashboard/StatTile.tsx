import type { ReactNode } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { surfaceColors } from "@/styles/theme";

/**
 * StatTile — a big-number stat card in the house style.
 *
 * Extracted from the admin dashboard's stat cards. Shows a label, a large
 * value, and an optional icon. `accent` recolors the value (e.g. green for a
 * good signal, red for something needing attention). Becomes clickable when
 * `onClick` is provided.
 */
export interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Color for the value text (defaults to normal text color). */
  accent?: string;
  loading?: boolean;
  onClick?: () => void;
}

export default function StatTile({ label, value, icon, accent, loading, onClick }: StatTileProps) {
  const isDark = useThemeStore((s) => s.isDark);
  const c = surfaceColors(isDark);
  const clickable = onClick !== undefined;

  return (
    <div
      onClick={onClick}
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        cursor: clickable ? "pointer" : "default",
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        if (clickable) e.currentTarget.style.borderColor = c.accent;
      }}
      onMouseLeave={(e) => {
        if (clickable) e.currentTarget.style.borderColor = c.border;
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.textMuted, fontSize: 13, marginBottom: 14 }}>
        <span>{label}</span>
        {icon && <span style={{ marginLeft: "auto", color: c.textFaint, fontSize: 16, lineHeight: 0 }}>{icon}</span>}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: loading ? c.textFaint : (accent ?? c.text),
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {loading ? "—" : value}
      </div>
    </div>
  );
}

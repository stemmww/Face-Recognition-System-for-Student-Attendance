import { useTranslation } from "react-i18next";
import type { MouseEvent, ReactNode } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { surfaceColors } from "@/styles/theme";

/**
 * StatTile - a big-number stat card in the house style.
 *
 * Mirrors the admin dashboard's stat cards: label/badge, large value, and a
 * footer area for progress or a small navigation link. `icon` remains supported
 * for secondary pages that still need it.
 */
export interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  progress?: number;
  linkLabel?: ReactNode;
  onLinkClick?: () => void;
  /** Color for the value text (defaults to normal text color). */
  accent?: string;
  loading?: boolean;
  onClick?: () => void;
}

export default function StatTile({
  label,
  value,
  icon,
  badge,
  progress,
  linkLabel,
  onLinkClick,
  accent,
  loading,
  onClick,
}: StatTileProps) {
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.isDark);
  const c = surfaceColors(isDark);
  const clickable = onClick !== undefined;
  const boundedProgress = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));

  const handleLinkClick = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    onLinkClick?.();
  };

  return (
    <div
      className="app-stat-tile"
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
        {badge ? (
          <span
            style={{
              marginLeft: "auto",
              background: c.greenSoft,
              color: c.green,
              fontSize: 10.5,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 6,
            }}
          >
            {badge}
          </span>
        ) : (
          icon && <span style={{ marginLeft: "auto", color: c.textFaint, fontSize: 16, lineHeight: 0 }}>{icon}</span>
        )}
      </div>

      <div
        className="app-stat-value"
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: loading ? c.textFaint : (accent ?? c.text),
          lineHeight: 1,
          marginBottom: 14,
          letterSpacing: "-0.02em",
        }}
      >
        {loading ? <>&mdash;</> : value}
      </div>

      {boundedProgress !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.textMuted }}>
            <span>{t("dashboard.progress")}</span>
            <span>{boundedProgress}%</span>
          </div>
          <div style={{ height: 6, background: c.surface3, borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${boundedProgress}%`,
                background: c.accent,
                borderRadius: 3,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: c.textMuted }}>
          {linkLabel && (
            <span
              onClick={handleLinkClick}
              style={{
                cursor: "pointer",
                color: c.textMuted,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = c.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
            >
              {linkLabel} <span aria-hidden="true">&rarr;</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

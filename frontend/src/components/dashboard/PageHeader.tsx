import type { ReactNode } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { surfaceColors } from "@/styles/theme";

/**
 * PageHeader — consistent page title row in the house style.
 *
 * A bold title on the left with optional content (buttons, tags) on the right.
 * Use at the top of a page above a <Panel>, replacing scattered Ant
 * <Typography.Title level={4}> headers so every page has the same heading
 * weight, size, and spacing.
 */
export interface PageHeaderProps {
  title: ReactNode;
  /** Right-aligned content (e.g. an "Add" button). */
  extra?: ReactNode;
  /** Optional secondary line below the title. */
  subtitle?: ReactNode;
}

export default function PageHeader({ title, extra, subtitle }: PageHeaderProps) {
  const isDark = useThemeStore((s) => s.isDark);
  const c = surfaceColors(isDark);

  return (
    <div
      style={{
        display: "flex",
        alignItems: subtitle ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {extra && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{extra}</div>}
    </div>
  );
}

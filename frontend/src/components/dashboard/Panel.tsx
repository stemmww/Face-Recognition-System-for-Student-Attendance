import type { CSSProperties, ReactNode } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { surfaceColors } from "@/styles/theme";

/**
 * Panel — the app's standard rounded surface card.
 *
 * This is the "house style" container extracted from the admin dashboard:
 * a soft-bordered, 16px-radius surface that adapts to dark/light via the
 * shared surfaceColors palette. Use it instead of Ant's <Card> when you want
 * the dashboard look; the working bits inside (tables, selects, charts) can
 * still be Ant components.
 */
export interface PanelProps {
  /** Optional header title shown top-left. */
  title?: ReactNode;
  /** Optional content shown top-right of the header (e.g. a Select, button). */
  extra?: ReactNode;
  children?: ReactNode;
  /** Extra styles merged onto the outer container. */
  style?: CSSProperties;
  /** Removes inner padding (useful when the child is a full-bleed table). */
  flush?: boolean;
}

export default function Panel({ title, extra, children, style, flush }: PanelProps) {
  const isDark = useThemeStore((s) => s.isDark);
  const c = surfaceColors(isDark);

  const hasHeader = title !== undefined || extra !== undefined;

  return (
    <div
      className="app-panel"
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        overflow: "hidden",
        ...style,
      }}
    >
      {hasHeader && (
        <div
          className="app-panel-header"
          style={{
            padding: "20px 20px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {title !== undefined ? (
            <span className="app-panel-title" style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{title}</span>
          ) : (
            <span />
          )}
          {extra && <div className="app-panel-extra">{extra}</div>}
        </div>
      )}
      <div className="app-panel-body" style={{ padding: flush ? 0 : hasHeader ? "0 20px 20px" : 20 }}>{children}</div>
    </div>
  );
}

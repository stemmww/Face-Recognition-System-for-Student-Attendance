import type { CSSProperties, ReactNode } from "react";
import { Tag } from "antd";
import { useThemeStore } from "@/stores/themeStore";

export type SoftTagTone =
  | "neutral"
  | "student"
  | "professor"
  | "admin"
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected";

interface SoftTagProps {
  tone?: SoftTagTone;
  icon?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}

const lightPalette: Record<SoftTagTone, { background: string; border: string; color: string }> = {
  neutral: { background: "#f1f5f9", border: "#e2e8f0", color: "#475569" },
  student: { background: "#f0f7f2", border: "#dbeadd", color: "#3f6b45" },
  professor: { background: "#eef5fb", border: "#d8e7f4", color: "#275c86" },
  admin: { background: "#f4f1fb", border: "#e6def8", color: "#5a4b7a" },
  active: { background: "#edf8f2", border: "#cdecdc", color: "#047857" },
  inactive: { background: "#f1f5f9", border: "#e2e8f0", color: "#475569" },
  pending: { background: "#fffbeb", border: "#fde68a", color: "#92400e" },
  approved: { background: "#edf8f2", border: "#cdecdc", color: "#047857" },
  rejected: { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
};

const darkPalette: Record<SoftTagTone, { background: string; border: string; color: string }> = {
  neutral: { background: "rgba(148, 163, 184, 0.13)", border: "rgba(148, 163, 184, 0.2)", color: "#cbd5e1" },
  student: { background: "rgba(74, 111, 83, 0.24)", border: "rgba(116, 149, 124, 0.24)", color: "#b9d8c0" },
  professor: { background: "rgba(59, 130, 246, 0.16)", border: "rgba(96, 165, 250, 0.22)", color: "#bfdbfe" },
  admin: { background: "rgba(139, 92, 246, 0.16)", border: "rgba(167, 139, 250, 0.22)", color: "#ddd6fe" },
  active: { background: "rgba(16, 185, 129, 0.15)", border: "rgba(52, 211, 153, 0.22)", color: "#86efac" },
  inactive: { background: "rgba(148, 163, 184, 0.13)", border: "rgba(148, 163, 184, 0.2)", color: "#cbd5e1" },
  pending: { background: "rgba(245, 158, 11, 0.15)", border: "rgba(251, 191, 36, 0.24)", color: "#fcd34d" },
  approved: { background: "rgba(16, 185, 129, 0.15)", border: "rgba(52, 211, 153, 0.22)", color: "#86efac" },
  rejected: { background: "rgba(239, 68, 68, 0.14)", border: "rgba(248, 113, 113, 0.24)", color: "#fca5a5" },
};

export default function SoftTag({ tone = "neutral", icon, children, style }: SoftTagProps) {
  const isDark = useThemeStore((s) => s.isDark);
  const colors = isDark ? darkPalette[tone] : lightPalette[tone];

  return (
    <Tag
      bordered={false}
      icon={icon}
      style={{
        margin: 0,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        borderRadius: 6,
        fontWeight: 500,
        lineHeight: "20px",
        paddingInline: 8,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

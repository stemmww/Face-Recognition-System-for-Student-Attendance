/**
 * Shared style constants and helpers for dark/light mode.
 *
 * Usage:
 *   const isDark = useThemeStore((s) => s.isDark);
 *   const colors = themeColors(isDark);
 *   <div style={authPageStyles.centeredPage(isDark)}>
 */

import type { CSSProperties } from "react";

export const BRAND_PRIMARY = "rgb(64, 169, 255)";
export const BRAND_PRIMARY_RGB = "64, 169, 255";
export const BRAND_PRIMARY_DARK = "rgb(38, 139, 220)";

// ---------------------------------------------------------------------------
// Color palette — call with isDark to get the right variant
// ---------------------------------------------------------------------------

export function themeColors(isDark: boolean) {
  return {
    /** Page / panel background */
    pageBg: isDark ? "rgb(12, 12, 12)" : "#f8fafc",
    /** Heading text (Title) */
    heading: isDark ? "#e2e8f0" : "#1e293b",
    /** Body / subtitle text */
    subtitle: isDark ? "#94a3b8" : "#64748b",
    /** Form label text */
    label: isDark ? "#cbd5e1" : "#334155",
    /** Input border */
    inputBorder: isDark ? "#334155" : "#e2e8f0",
    /** Muted icon inside inputs */
    inputIcon: "#94a3b8",
    /** Primary accent */
    primary: BRAND_PRIMARY,
    /** Divider / separator border */
    divider: isDark ? "#334155" : "#e2e8f0",
  } as const;
}

// ---------------------------------------------------------------------------
// Reusable style objects for auth pages (Login, ResetPassword)
// ---------------------------------------------------------------------------

export const authPageStyles = {
  /** Full-viewport centered layout (login, reset-password result screens) */
  centeredPage: (isDark: boolean): CSSProperties => ({
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isDark ? "rgb(12, 12, 12)" : "#f8fafc",
    transition: "background 0.4s ease",
  }),

  /** Constrained card wrapper for form content */
  formCard: {
    width: "100%",
    maxWidth: 400,
  } as CSSProperties,

  /** Standard form input */
  input: {
    height: 44,
    borderRadius: 10,
  } as CSSProperties,

  /** Primary submit button */
  primaryButton: {
    height: 44,
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 15,
    boxShadow: `0 4px 14px rgba(${BRAND_PRIMARY_RGB}, 0.35)`,
  } as CSSProperties,

  /** Form label span */
  formLabel: (isDark: boolean): CSSProperties => ({
    fontWeight: 500,
    color: isDark ? "#cbd5e1" : "#334155",
  }),
};

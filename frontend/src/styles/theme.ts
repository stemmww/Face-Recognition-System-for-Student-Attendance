/**
 * Shared style constants and helpers for dark/light mode.
 *
 * Usage:
 *   const isDark = useThemeStore((s) => s.isDark);
 *   const colors = themeColors(isDark);
 *   <div style={authPageStyles.centeredPage(isDark)}>
 */

import type { CSSProperties } from "react";

export const BRAND_PRIMARY = "rgb(1, 123, 223)";
export const BRAND_PRIMARY_RGB = "1, 123, 223";
export const BRAND_PRIMARY_DARK = "rgb(1, 101, 184)";

// Sync the brand color into CSS so plain stylesheets (global.css) can use
// var(--brand-primary) without duplicating the literal. Keeps theme.ts the
// single source of truth.
export function applyBrandCssVars(): void {
  document.documentElement.style.setProperty("--brand-primary", BRAND_PRIMARY);
}

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
// Surface palette — richer token set for card-based pages (dashboards).
// Single source of truth so the brand blue and surface colors stay
// consistent with themeColors() instead of being re-hardcoded per page.
// ---------------------------------------------------------------------------

export function surfaceColors(isDark: boolean) {
  return {
    surface: isDark ? "rgb(33, 33, 33)" : "#ffffff",
    surface3: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
    hover: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    borderStrong: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
    text: isDark ? "#e2e8f0" : "#1e293b",
    textMuted: isDark ? "#94a3b8" : "#64748b",
    textFaint: isDark ? "#64748b" : "#94a3b8",
    accent: BRAND_PRIMARY,
    accentSoft: isDark ? `rgba(${BRAND_PRIMARY_RGB},0.18)` : `rgba(${BRAND_PRIMARY_RGB},0.08)`,
    blue: BRAND_PRIMARY,
    green: isDark ? "#34d399" : "#10b981",
    greenSoft: isDark ? "#064e3b" : "#d1fae5",
    orange: isDark ? "#fbbf24" : "#f59e0b",
    orangeSoft: isDark ? "rgba(251,191,36,0.15)" : "#fef3c7",
    red: isDark ? "#f87171" : "#ef4444",
    chartBar: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
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

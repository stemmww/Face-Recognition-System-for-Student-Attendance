import { create } from "zustand";

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

function applyBodyClass(isDark: boolean) {
  document.body.classList.toggle("dark", isDark);
}

// Apply on initial load
const initialDark = localStorage.getItem("theme") === "dark";
applyBodyClass(initialDark);

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: initialDark,
  toggle: () =>
    set((state) => {
      const next = !state.isDark;
      localStorage.setItem("theme", next ? "dark" : "light");
      applyBodyClass(next);
      return { isDark: next };
    }),
}));

"use client";

// Light/dark theme provider. Persists to localStorage and toggles a `.light`
// class on <html>. A pre-paint script in the root layout applies the stored
// theme before hydration to avoid a flash / mismatch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
});

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialise from the DOM class set by the pre-paint script (client) so the
  // very first client render already matches the applied theme.
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    document.documentElement.classList.toggle("light", t === "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Keep state in sync if another tab changes the theme.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "theme" && (e.newValue === "light" || e.newValue === "dark")) {
        setThemeState(e.newValue);
        document.documentElement.classList.toggle("light", e.newValue === "light");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

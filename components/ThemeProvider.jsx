"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("chesso-theme") || "dark";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function applyTheme(t) {
    // Preserve font variable classes already on body (added by Next.js layout)
    const body = document.body;
    const fontClasses = Array.from(body.classList).filter(c => c.startsWith("__variable"));
    body.className = fontClasses.join(" ");
    if (t === "light") body.classList.add("light-mode");
    // dark is the default — no class needed
  }

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("chesso-theme", next);
    applyTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

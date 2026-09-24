"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { translate, type SiteLanguage } from "@/lib/language";

const STORAGE_KEY = "xiang-language";
type LanguageContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
  t: (source: string, values?: Record<string, string | number>) => string;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [language, setLanguageState] = useState<SiteLanguage>("en");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Language selection still works for this page if storage is unavailable.
    }
    const timer = window.setTimeout(() => {
      if (saved === "en" || saved === "zh-Hant" || saved === "zh-Hans")
        setLanguageState(saved);
      setInitialized(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    if (!initialized) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Keep the selected language for the current app session.
    }
  }, [language, initialized]);

  useEffect(() => {
    const titleByPath: Record<string, string> = {
      "/": "Xiang 想 — A little character play",
      "/playground": "Character physics lab — Xiang playground",
      "/inspector": "Dictionary lab — Xiang",
      "/privacy": "Privacy — Xiang",
    };
    document.title = translate(
      language,
      titleByPath[pathname] ?? titleByPath["/"],
    );
  }, [language, pathname]);

  const setLanguage = useCallback((next: SiteLanguage) => {
    setLanguageState(next);
  }, []);
  const t = useCallback(
    (source: string, values?: Record<string, string | number>) =>
      translate(language, source, values),
    [language],
  );
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

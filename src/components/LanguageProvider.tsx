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
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import type { CharacterVariantMaps, WritingSystem } from "@/lib/indicesClient";

const STORAGE_KEY = "xiang-language";
const WRITING_SYSTEM_STORAGE_KEY = "xiang-writing-system";
type LanguageContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
  writingSystem: WritingSystem;
  setWritingSystem: (system: WritingSystem) => void;
  characterVariants: CharacterVariantMaps | null;
  playgroundCharacterVariants: CharacterVariantMaps | null;
  writingSystemLoading: boolean;
  t: (source: string, values?: Record<string, string | number>) => string;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [language, setLanguageState] = useState<SiteLanguage>("en");
  const [initialized, setInitialized] = useState(false);
  const [writingSystem, setWritingSystemState] =
    useState<WritingSystem>("simplified");
  const [characterVariants, setCharacterVariants] =
    useState<CharacterVariantMaps | null>(null);
  const [playgroundCharacterVariants, setPlaygroundCharacterVariants] =
    useState<CharacterVariantMaps | null>(null);
  const [writingSystemLoading, setWritingSystemLoading] = useState(true);

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
    let active = true;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(WRITING_SYSTEM_STORAGE_KEY);
    } catch {
      // Writing-system selection still works for this page if storage is unavailable.
    }
    fetch(publicAssetUrl("data/playground/variants.json"))
      .then((response) => {
        if (!response.ok) throw new Error("Character variants unavailable.");
        return response.json() as Promise<{
          schemaVersion: number;
          mappings: CharacterVariantMaps;
          playgroundMappings: CharacterVariantMaps;
        }>;
      })
      .then((result) => {
        if (!active || result.schemaVersion !== 1) return;
        setCharacterVariants(result.mappings);
        setPlaygroundCharacterVariants(result.playgroundMappings);
        if (saved === "simplified" || saved === "traditional")
          setWritingSystemState(saved);
      })
      .catch(() => {
        if (active) {
          const empty = { simplified: {}, traditional: {} };
          setCharacterVariants(empty);
          setPlaygroundCharacterVariants(empty);
        }
      })
      .finally(() => {
        if (active) setWritingSystemLoading(false);
      });
    return () => {
      active = false;
    };
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
  const setWritingSystem = useCallback((next: WritingSystem) => {
    setWritingSystemState(next);
  }, []);
  useEffect(() => {
    if (writingSystemLoading) return;
    try {
      window.localStorage.setItem(WRITING_SYSTEM_STORAGE_KEY, writingSystem);
    } catch {
      // Keep the selected writing system for the current app session.
    }
  }, [writingSystem, writingSystemLoading]);
  const t = useCallback(
    (source: string, values?: Record<string, string | number>) =>
      translate(language, source, values),
    [language],
  );
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      writingSystem,
      setWritingSystem,
      characterVariants,
      playgroundCharacterVariants,
      writingSystemLoading,
      t,
    }),
    [
      language,
      setLanguage,
      writingSystem,
      setWritingSystem,
      characterVariants,
      playgroundCharacterVariants,
      writingSystemLoading,
      t,
    ],
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

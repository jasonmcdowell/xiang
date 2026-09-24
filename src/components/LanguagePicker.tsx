"use client";

import { useLanguage } from "./LanguageProvider";

export default function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label className="language-picker">
      <span>{t("Language")}</span>
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
      >
        <option value="en">English</option>
        <option value="zh-Hant" lang="zh-Hant">
          {language === "en" ? "Traditional Chinese" : t("Traditional")}
        </option>
        <option value="zh-Hans" lang="zh-Hans">
          {language === "en" ? "Simplified Chinese" : t("Simplified")}
        </option>
      </select>
    </label>
  );
}

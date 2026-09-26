"use client";

import { useLanguage } from "./LanguageProvider";

export default function WritingSystemPicker() {
  const { t, writingSystem, setWritingSystem, writingSystemLoading } =
    useLanguage();
  return (
    <label className="language-picker writing-system-picker">
      <span>{t("Tile writing")}</span>
      <select
        aria-label={t("Tile writing")}
        value={writingSystem}
        disabled={writingSystemLoading}
        onChange={(event) =>
          setWritingSystem(event.target.value as typeof writingSystem)
        }
      >
        <option value="simplified">{t("Simplified tiles")}</option>
        <option value="traditional">{t("Traditional tiles")}</option>
      </select>
    </label>
  );
}

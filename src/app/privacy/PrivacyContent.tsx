"use client";

import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import { useLanguage } from "@/components/LanguageProvider";

export default function PrivacyContent() {
  const { t } = useLanguage();
  return (
    <main className="privacy-page app-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark hanzi" lang="zh">
            想
          </span>
          xiang.
        </Link>
        <LanguagePicker />
      </header>
      <section className="privacy-copy">
        <p className="eyebrow">{t("A SMALL, SELF-CONTAINED PROJECT")}</p>
        <h1>{t("Privacy")}</h1>
        <p>
          {t(
            "Xiang runs in your browser. Its application code does not create accounts, send game actions to a server, set or read cookies, store gameplay activity, or load analytics or advertising scripts. Your game state stays in memory for the current page visit and resets when you reload. Your chosen language preference is stored locally in your browser and is not sent to Xiang servers.",
          )}
        </p>
        <p>
          {t(
            "The site is hosted by GitHub Pages. GitHub says it logs and stores visitors’ IP addresses for security purposes. GitHub handles that information under its own privacy practices. Read the ",
          )}{" "}
          <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
            {t("GitHub Privacy Statement")}
          </a>
          .
        </p>
        <p>
          {t(
            "Xiang is a personal project by Jason McDowell. For questions, use the ",
          )}{" "}
          <a href="https://github.com/jasonmcdowell/xiang">
            {t("Xiang project repository")}
          </a>
          .
        </p>
        <Link className="secondary" href="/">
          {t("← Back to Xiang")}
        </Link>
      </section>
    </main>
  );
}

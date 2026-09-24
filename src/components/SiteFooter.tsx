"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

export default function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="privacy-footer">
      <Link href="/privacy">{t("Privacy")}</Link>
    </footer>
  );
}

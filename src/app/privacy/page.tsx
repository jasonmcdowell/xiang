import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Xiang",
  description: "What Xiang and its GitHub Pages host do with visitor data.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page app-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark hanzi" lang="zh">
            想
          </span>
          xiang.
        </Link>
      </header>
      <section className="privacy-copy">
        <p className="eyebrow">A SMALL, SELF-CONTAINED PROJECT</p>
        <h1>Privacy</h1>
        <p>
          Xiang runs in your browser. Its application code does not create
          accounts, send game actions to a server, set or read cookies, use
          browser storage, or load analytics or advertising scripts. Your game
          state stays in memory for the current page visit and resets when you
          reload.
        </p>
        <p>
          The site is hosted by GitHub Pages. GitHub says it logs and stores
          visitors’ IP addresses for security purposes. GitHub handles that
          information under its own privacy practices. Read the{" "}
          <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
            GitHub Privacy Statement
          </a>
          .
        </p>
        <p>
          Xiang is a personal project by Jason McDowell. For questions, use the{" "}
          <a href="https://github.com/jasonmcdowell/xiang">
            Xiang project repository
          </a>
          .
        </p>
        <Link className="secondary" href="/">
          ← Back to Xiang
        </Link>
      </section>
    </main>
  );
}

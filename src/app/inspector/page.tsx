"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import { useLanguage } from "@/components/LanguageProvider";
import {
  loadIndices,
  normalizeChar,
  type IndicesData,
} from "@/lib/indicesClient";
import { composeTiles, decompose } from "@/lib/game";
const first = (value: string) => Array.from(value.trim())[0] ?? "";
export default function InspectorPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<IndicesData | null>(null);
  const [error, setError] = useState(false);
  const [character, setCharacter] = useState("想");
  const [a, setA] = useState("相");
  const [b, setB] = useState("心");
  const [c, setC] = useState("");
  useEffect(() => {
    let active = true;
    loadIndices()
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const normalized = normalizeChar(first(character));
  const normalizedA = normalizeChar(first(a)),
    normalizedB = normalizeChar(first(b));
  const children = data ? decompose(data, normalized) : null;
  const candidates = data
    ? composeTiles(
        data,
        [normalizedA, normalizedB, normalizeChar(first(c))].filter(Boolean),
      )
    : [];
  return (
    <div className="app-shell lab">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark hanzi" lang="zh">
            想
          </span>
          xiang.
        </Link>
        <LanguagePicker />
        <Link className="secondary" href="/">
          {t("← Back to play")}
        </Link>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">{t("A CLOSER LOOK AT THE PIECES")}</p>
          <h1>{t("The dictionary lab.")}</h1>
          <p className="intro-copy">
            {t(
              "Explore the same supported relationships that make the game work.",
            )}
          </p>
        </div>
      </section>
      {!data && (
        <p role="status">
          {error
            ? t("The dictionary couldn’t load. Please reload to try again.")
            : t("Loading character data…")}
        </p>
      )}
      {data && (
        <>
          <div className="lab-stats">
            {Object.keys(data.decomp).length.toLocaleString()}{" "}
            {t("complete decompositions")} <span>·</span>{" "}
            {Object.keys(data.compose).length.toLocaleString()}{" "}
            {t("ordered pair entries")}
          </div>
          <div className="lab-grid">
            <section className="board-panel lab-card">
              <p className="eyebrow">{t("01 / TAKE APART")}</p>
              <h2>{t("Inside a character")}</h2>
              <label htmlFor="lookup-character">{t("Character")}</label>
              <input
                id="lookup-character"
                value={character}
                onChange={(e) => setCharacter(e.target.value)}
                placeholder="想"
                maxLength={8}
              />
              <p className="guide-note">
                {t("Normalized: ")}
                <span lang="zh">{normalized || "—"}</span>
              </p>
              <div className="lab-results" aria-live="polite">
                {children ? (
                  children.map((c, i) => (
                    <button
                      key={`${c}-${i}`}
                      className="lab-tile"
                      onClick={() => setCharacter(c)}
                    >
                      <span className="hanzi" lang="zh">
                        {c}
                      </span>
                      <small>{data.meta[c]?.pinyin[0]}</small>
                    </button>
                  ))
                ) : (
                  <p>{t("No supported decomposition found.")}</p>
                )}
              </div>
              <p className="guide-note">
                {data.meta[normalized]?.pinyin.join(" · ")}
                <br />
                {data.meta[normalized]?.definition}
              </p>
            </section>
            <section className="board-panel lab-card">
              <p className="eyebrow">{t("02 / PUT TOGETHER")}</p>
              <h2>{t("Find a new character")}</h2>
              <div className="lab-inputs">
                <div>
                  <label htmlFor="component-a">{t("Component A")}</label>
                  <input
                    id="component-a"
                    value={a}
                    onChange={(e) => setA(e.target.value)}
                    maxLength={8}
                  />
                  <p className="guide-note">
                    {t("Normalized: ")}
                    {normalizedA || "—"}
                    <br />
                    {t("Frequency: ")} {data.freq[normalizedA] ?? "—"}
                  </p>
                </div>
                <div>
                  <label htmlFor="component-b">{t("Component B")}</label>
                  <input
                    id="component-b"
                    value={b}
                    onChange={(e) => setB(e.target.value)}
                    maxLength={8}
                  />
                  <p className="guide-note">
                    {t("Normalized: ")}
                    {normalizedB || "—"}
                    <br />
                    {t("Frequency: ")} {data.freq[normalizedB] ?? "—"}
                  </p>
                </div>
              </div>
              <label htmlFor="component-c">{t("Component C (optional)")}</label>
              <input
                id="component-c"
                value={c}
                onChange={(e) => setC(e.target.value)}
                maxLength={8}
                placeholder={t("For three-piece recipes")}
              />
              <div className="lab-results" aria-live="polite">
                {candidates.length ? (
                  candidates.map((c) => (
                    <button
                      className="lab-tile"
                      key={c}
                      onClick={() => setCharacter(c)}
                      title={data.meta[c]?.definition}
                    >
                      <span className="hanzi" lang="zh">
                        {c}
                      </span>
                      <small>{data.meta[c]?.pinyin[0]}</small>
                    </button>
                  ))
                ) : (
                  <p>{t("No matching composition found.")}</p>
                )}
              </div>
              <p className="guide-note">
                {t("Order doesn’t matter. Select a result to look inside it.")}
              </p>
            </section>
          </div>
          <p className="guide-note lab-note">
            {t(
              "Only complete recipes are kept. Reviewed nested recipes such as 森 → 木 + 木 + 木 are supported; other nested expressions remain excluded. common forms such as 忄 and 氵 normalize to 心 and 水. These structural recipes are not claims about etymology.",
            )}
          </p>
        </>
      )}
    </div>
  );
}

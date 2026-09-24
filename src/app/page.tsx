"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDragCombine } from "@/hooks/useDragCombine";
import { useTileMotion } from "@/hooks/useTileMotion";
import { loadIndices, type IndicesData } from "@/lib/indicesClient";
import {
  CAPACITY,
  SAMPLE_SETS,
  composeTiles,
  createGame,
  decompose,
  gameReducer,
  type Action,
  type GameState,
  type Tile,
} from "@/lib/game";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="hanzi" lang="zh">
      {children}
    </span>
  );
}
function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Xiang home">
      <span className="brand-mark">
        <Glyph>想</Glyph>
      </span>
      <span>
        xiang<span className="brand-dot">.</span>
      </span>
      <span className="brand-caption">A LITTLE CHARACTER PLAY</span>
    </Link>
  );
}
export default function Home() {
  const [data, setData] = useState<IndicesData | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadIndices()
      .then((d) => {
        if (active) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (!data)
    return (
      <main className="loading-page">
        <Brand />
        <div className="loading-glyph">
          <Glyph>想</Glyph>
        </div>
        <h1>
          {error
            ? "The characters couldn’t load."
            : "A little room for discovery."}
        </h1>
        <p>
          {error
            ? "Check your connection and try again."
            : "Setting out your tiles…"}
        </p>
        {error && (
          <button
            className="primary"
            onClick={() => {
              setError(false);
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
        )}
      </main>
    );
  return <Game data={data} />;
}

function Game({ data }: { data: IndicesData }) {
  const [state, setState] = useState<GameState>(() =>
    createGame("explore", data),
  );
  const { capture: captureMotion, cancel: cancelMotion } = useTileMotion(
    state.board,
    state.tray,
  );
  const [pinyin, setPinyin] = useState(true);
  const [help, setHelp] = useState(false);
  const [sample, setSample] = useState(0);
  const [input, setInput] = useState("");
  const [best, setBest] = useState(0);
  const [guide, setGuide] = useState<string | null>(null);
  const manualClock = useRef(false);
  const last = useRef(0);
  const chooser = useRef<HTMLDialogElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const combineButton = useRef<HTMLButtonElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = { ...state, focused: guide ?? state.focused };
  }, [state, guide]);
  const send = useCallback(
    (action: Action) => {
      if (["split", "compose", "choose", "undo", "drop"].includes(action.type))
        captureMotion();
      const now = performance.now();
      const ms = manualClock.current ? 0 : Math.max(0, now - last.current);
      last.current = now;
      setState((s) =>
        gameReducer(
          gameReducer(s, { type: "advance", ms }, data),
          action,
          data,
        ),
      );
      if (action.type !== "advance") setGuide(null);
    },
    [data, captureMotion],
  );
  const drag = useDragCombine(
    state,
    data,
    (sourceId, targetId) => send({ type: "drop", sourceId, targetId }),
    cancelMotion,
  );
  useEffect(() => {
    last.current = performance.now();
    const timer = setInterval(() => {
      if (!manualClock.current) send({ type: "advance", ms: 0 });
    }, 100);
    const hide = () => {
      if (document.hidden) send({ type: "pause" });
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [send]);
  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify({
        ...stateRef.current,
        previous: undefined,
        coordinateSystem:
          "DOM tiles; board above tray; tile IDs identify controls.",
      });
    window.advanceTime = (ms) => {
      manualClock.current = true;
      setState((s) => gameReducer(s, { type: "advance", ms }, data));
    };
    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [data]);
  useEffect(() => {
    if (state.mode === "challenge" && state.score > best) {
      setBest(state.score);
    }
  }, [state.score, state.mode, best]);
  useEffect(() => {
    if (state.candidates.length) chooser.current?.showModal();
    else if (chooser.current?.open) {
      chooser.current.close();
      combineButton.current?.focus();
    }
  }, [state.candidates]);
  useEffect(() => {
    if (help) helpDialog.current?.showModal();
    else helpDialog.current?.close();
  }, [help]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !chooser.current?.open &&
        !helpDialog.current?.open
      )
        send({ type: "cancel" });
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [send]);
  function reset(mode = state.mode, set = sample) {
    drag.cancel();
    cancelMotion();
    last.current = performance.now();
    setState(
      createGame(mode, data, Math.floor(Math.random() * 4294967295) || 1, set),
    );
    setGuide(null);
  }
  const active = state.phase === "playing";
  const isChallenge = state.mode === "challenge";
  const focused = guide ?? state.focused;
  const meta = data.meta[focused];
  const children = decompose(data, focused);
  const selected = state.selected
    .map((id) => state.tray.find((t) => t.id === id)!)
    .filter(Boolean);
  const matches = composeTiles(
    data,
    selected.map((t) => t.char),
  );
  function renderTile(t: Tile, area: "board" | "tray") {
    const checked = state.selected.includes(t.id);
    const hinted = state.hinted.includes(t.id);
    const unfolds = !!decompose(data, t.char);
    const faceSplits = area === "board" || unfolds;
    return (
      <div
        key={t.id}
        className={`tile-wrap ${area === "board" ? "board-wrap" : ""}`}
        data-tile-id={t.id}
        data-char={t.char}
        data-drag-id={area === "tray" ? t.id : undefined}
        onPointerDown={
          area === "tray" ? (e) => drag.pointerDown(e, t.id) : undefined
        }
        onClickCapture={(e) => {
          if (drag.suppressClick()) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        <button
          className={`tile ${area === "board" ? "board-tile" : ""} ${checked ? "selected" : ""} ${hinted ? "hinted" : ""}`}
          data-select-id={!faceSplits ? t.id : undefined}
          data-hinted={hinted || undefined}
          aria-label={`${faceSplits ? "Split" : "Select"} ${t.char}${hinted ? ", can combine with another tile" : ""}`}
          aria-pressed={!faceSplits ? checked : undefined}
          disabled={!active}
          onClick={() =>
            send({ type: faceSplits ? "split" : "select", id: t.id })
          }
          onMouseEnter={() => setGuide(t.char)}
          onMouseLeave={() => setGuide(null)}
          onFocus={() => setGuide(t.char)}
          onBlur={() => setGuide(null)}
        >
          <Glyph>{t.char}</Glyph>
          <span className={`tile-pinyin ${pinyin ? "" : "hidden-pinyin"}`}>
            {data.meta[t.char]?.pinyin[0] || "—"}
          </span>
          {unfolds && <span className="unfold-label">Unfold ↗</span>}
        </button>
        {area === "tray" && (
          <span
            className="drag-grip"
            title="Drag onto another tile to combine"
            aria-hidden="true"
          >
            ⠿
          </span>
        )}
        {area === "tray" && unfolds && (
          <button
            className={`tile-selector ${checked ? "checked" : ""}`}
            data-select-id={t.id}
            aria-label={`Select ${t.char}`}
            aria-pressed={checked}
            title={`Select ${t.char} to combine without unfolding`}
            disabled={!active}
            onClick={() => send({ type: "select", id: t.id })}
          >
            {checked ? "✓" : "+"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`app-shell ${isChallenge ? "challenge-mode" : ""}`}>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main">
          <Link href="/playground">
            Playground <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/inspector">
            Dictionary lab <span aria-hidden="true">↗</span>
          </Link>
          <button
            className="text-button"
            onClick={() => {
              if (isChallenge) send({ type: "pause" });
              setHelp(true);
            }}
          >
            How to play <span className="help-circle">?</span>
          </button>
        </nav>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">
              TAKE APART. PUT TOGETHER. SEE SOMETHING NEW.
            </p>
            <h1>
              A world inside every character<span>.</span>
            </h1>
            <p className="intro-copy">
              A tree. An eye. A heart. A thought. Discover how Chinese
              characters connect.
            </p>
          </div>
          <div
            className="intro-formula"
            aria-label="Tree plus eye plus heart becomes thought"
          >
            <Glyph>木</Glyph>
            <i>+</i>
            <Glyph>目</Glyph>
            <i>+</i>
            <Glyph>心</Glyph>
            <i>=</i>
            <Glyph>想</Glyph>
          </div>
        </section>
        <div className="mode-bar">
          <div className="mode-switch" aria-label="Game mode">
            <button
              aria-pressed={!isChallenge}
              onClick={() => {
                if (isChallenge) reset("explore");
              }}
            >
              <span>◌</span> Explore
            </button>
            <button
              aria-pressed={isChallenge}
              onClick={() => {
                if (!isChallenge) reset("challenge");
              }}
            >
              <span>◷</span> Timed challenge
            </button>
          </div>
          <span className="mode-caption">
            {isChallenge
              ? "A little pressure. A lot of possibility."
              : "No clock. Just curiosity."}
          </span>
          <label className="pinyin-toggle">
            <input
              type="checkbox"
              checked={pinyin}
              onChange={(e) => setPinyin(e.target.checked)}
            />
            <span className="switch-track" /> Pinyin
          </label>
        </div>
        <div className="game-layout">
          <div className="play-column">
            {isChallenge && state.phase !== "playing" && (
              <section className="run-card" aria-label="Run controls">
                <div>
                  <p className="eyebrow">
                    {state.phase === "ready"
                      ? "READY WHEN YOU ARE"
                      : state.phase === "paused"
                        ? "TAKE A BREATH"
                        : "A LITTLE MORE DISCOVERED"}
                  </p>
                  <h2>
                    {state.phase === "ready"
                      ? "60 seconds. How much will you discover?"
                      : state.phase === "paused"
                        ? "Your table is waiting."
                        : state.reason === "overflow"
                          ? "A full tray. A fresh start?"
                          : "Time’s up. Nicely explored."}
                  </h2>
                  <p>
                    {state.phase === "ready"
                      ? "8 starting tiles. A new one every 6 seconds. Make space before the 13th arrives."
                      : state.phase === "paused"
                        ? "The clock and incoming tiles are paused."
                        : `${state.score} points · ${state.discovered.length} unique discoveries this run.`}
                  </p>
                </div>
                <button
                  id="start-btn"
                  className="primary"
                  onClick={() =>
                    state.phase === "ready"
                      ? send({ type: "start" })
                      : state.phase === "paused"
                        ? send({ type: "resume" })
                        : reset("challenge")
                  }
                >
                  {state.phase === "ready"
                    ? "Start challenge →"
                    : state.phase === "paused"
                      ? "Keep playing →"
                      : "New run →"}
                </button>
              </section>
            )}
            {isChallenge && (
              <section
                className="challenge-strip"
                aria-label="Challenge status"
              >
                <div>
                  <span className="eyebrow">TIME LEFT</span>
                  <strong className={state.remaining <= 10000 ? "danger" : ""}>
                    {Math.ceil(state.remaining / 1000)}
                    <small>s</small>
                  </strong>
                </div>
                <div>
                  <span className="eyebrow">SCORE</span>
                  <strong>{state.score.toString().padStart(2, "0")}</strong>
                </div>
                <div>
                  <span className="eyebrow">SESSION BEST</span>
                  <strong>{best.toString().padStart(2, "0")}</strong>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    state.phase === "paused"
                      ? send({ type: "resume" })
                      : send({ type: "pause" })
                  }
                  disabled={state.phase === "ready" || state.phase === "over"}
                >
                  {state.phase === "paused" ? "Resume" : "Pause"}
                </button>
              </section>
            )}
            <section className="board-panel" aria-label="Character board">
              <div className="panel-heading">
                <div>
                  <span className="section-number">01</span>
                  <h2>Your character board</h2>
                </div>
                <span>{state.board.length} characters</span>
              </div>
              <p className="panel-description">
                Click a character to unfold it into its parts.
              </p>
              <div className="board-tiles">
                {state.board.map((t) => renderTile(t, "board"))}
                {state.board.length === 0 && (
                  <div className="empty-board">
                    <span>合</span>
                    <p>
                      Your next discovery belongs here.
                      <br />
                      <small>
                        Combine two or three tiles from the tray below.
                      </small>
                    </p>
                  </div>
                )}
              </div>
              <div className="board-footer">
                <span>
                  <span className="small-spark">✳</span>{" "}
                  {isChallenge
                    ? "Made characters stay here. Split them to reuse their parts."
                    : "Unfold one tile at a time. Use + to select a tray tile intact."}
                </span>
                {!isChallenge && (
                  <button
                    className="text-button"
                    disabled={!state.previous}
                    onClick={() => send({ type: "undo" })}
                  >
                    ↶ Undo
                  </button>
                )}
              </div>
            </section>
            <section className="tray-panel" aria-label="Component tray">
              <div className="panel-heading">
                <div>
                  <span className="section-number">02</span>
                  <h2>Your component tray</h2>
                </div>
                <span
                  className={
                    isChallenge && state.tray.length >= 10 ? "danger" : ""
                  }
                >
                  {state.tray.length}
                  {isChallenge ? ` / ${CAPACITY}` : ""} tiles
                </span>
              </div>
              <p className="panel-description">
                Drag a tile onto another to combine. On touch screens, use the
                dotted grip. Click to unfold; use + to select.
              </p>
              <div className="tray-tiles">
                {state.tray.map((t) => renderTile(t, "tray"))}
                {Array.from(
                  {
                    length: Math.max(
                      0,
                      (isChallenge ? CAPACITY : 8) - state.tray.length,
                    ),
                  },
                  (_, i) => (
                    <div
                      className="tile empty-slot"
                      key={`empty-${i}`}
                      aria-hidden="true"
                    >
                      +
                    </div>
                  ),
                )}
              </div>
              {isChallenge && (
                <div className="drip-indicator">
                  <div>
                    <span
                      style={{ width: `${(1 - state.dripIn / 6000) * 100}%` }}
                    />
                  </div>
                  <span>Next tile in {Math.ceil(state.dripIn / 1000)}s</span>
                </div>
              )}
              <div className="composition-bar">
                <div
                  className="selection-preview"
                  aria-label="Selected components"
                >
                  <span>
                    <Glyph>{selected[0]?.char ?? "·"}</Glyph>
                  </span>
                  <i>+</i>
                  <span>
                    <Glyph>{selected[1]?.char ?? "·"}</Glyph>
                  </span>
                  {selected[2] && (
                    <>
                      <i>+</i>
                      <span>
                        <Glyph>{selected[2].char}</Glyph>
                      </span>
                    </>
                  )}
                  <span className="selection-note">
                    {selected.length >= 2
                      ? "A new possibility?"
                      : "Pick two pieces"}
                  </span>
                </div>
                <div className="compose-actions">
                  <button
                    className="text-button"
                    disabled={!active}
                    aria-pressed={state.hinted.length > 0}
                    title={
                      state.hinted.length
                        ? "Hide combination hints"
                        : "Highlight all tiles with a valid combination partner"
                    }
                    onClick={() => send({ type: "hint" })}
                  >
                    ✧ Hint
                  </button>
                  <button
                    ref={combineButton}
                    className="primary"
                    disabled={!active || selected.length < 2}
                    onClick={() => send({ type: "compose" })}
                  >
                    Combine <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </div>
            </section>
            <div
              className={`feedback ${state.message.startsWith("No match") ? "invalid" : ""}`}
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true">
                {state.message.startsWith("No match") ? "↔" : "✳"}
              </span>
              <p>{state.message}</p>
            </div>
            {!isChallenge && (
              <div className="explore-controls">
                <label>
                  Tile set{" "}
                  <select
                    aria-label="Tile set"
                    value={sample}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setSample(n);
                      reset("explore", n);
                    }}
                  >
                    {SAMPLE_SETS.map((s, i) => (
                      <option value={i} key={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="text-button" onClick={() => reset()}>
                  ↻ Reset table
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send({ type: "add", char: input });
                    setInput("");
                  }}
                >
                  <label className="sr-only" htmlFor="add-character">
                    Add a character
                  </label>
                  <input
                    id="add-character"
                    placeholder="Try a character: 好"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={8}
                  />
                  <button type="submit" aria-label="Add character">
                    +
                  </button>
                </form>
              </div>
            )}
            {isChallenge && state.phase === "playing" && (
              <div className="run-note">
                +3 seconds per composition · +1 point, plus +1 for a new
                discovery
              </div>
            )}
          </div>
          <aside className="field-guide" aria-label="Character field guide">
            <div className="guide-heading">
              <span className="eyebrow">THE FIELD GUIDE</span>
              <span>↗</span>
            </div>
            <div className="guide-character">
              <Glyph>{focused}</Glyph>
              <span>
                {meta?.pinyin.join(" · ") || "Pronunciation unavailable"}
              </span>
            </div>
            <div className="guide-definition">
              <h2>
                {meta?.definition.split(";")[0] || "A character to explore"}
              </h2>
              <p>
                {meta?.definition.includes(";")
                  ? meta.definition
                      .slice(meta.definition.indexOf(";") + 1)
                      .trim()
                  : "Every piece is a place to begin."}
              </p>
            </div>
            <div className="guide-divider" />
            <p className="eyebrow">
              {children ? "LOOK INSIDE" : "A SINGLE PIECE"}
            </p>
            {children ? (
              <>
                <div className="guide-recipe">
                  {children.map((c, i) => (
                    <span key={`${c}-${i}`}>
                      {i > 0 && <i>+</i>}
                      <button
                        onClick={() => setGuide(c)}
                        aria-label={`Learn about ${c}`}
                      >
                        <Glyph>{c}</Glyph>
                      </button>
                    </span>
                  ))}
                </div>
                <p className="guide-note">
                  {children
                    .map(
                      (c) =>
                        `${c} · ${data.meta[c]?.definition.split(";")[0] || "component"}`,
                    )
                    .join(" / ")}
                </p>
              </>
            ) : (
              <p className="guide-note">
                No supported split in our dictionary. This tile may still be a
                part of another character.
              </p>
            )}
            <div className="field-note">
              <span>GOOD TO KNOW</span>
              <p>
                Parts sometimes change shape inside a character.{" "}
                <Glyph>心</Glyph> can appear as <Glyph>忄</Glyph> — we keep the
                full character on your tile.
              </p>
            </div>
          </aside>
        </div>
        <section className="discoveries">
          <div>
            <span className="eyebrow">YOUR SMALL COLLECTION</span>
            <h2>
              Made by you{" "}
              <span>{state.discovered.length.toString().padStart(2, "0")}</span>
            </h2>
          </div>
          <div className="discovery-list">
            {state.discovered.length ? (
              state.discovered.map((c) => (
                <button
                  key={c}
                  onClick={() => setGuide(c)}
                  title={data.meta[c]?.definition}
                >
                  <Glyph>{c}</Glyph>
                  <span>{data.meta[c]?.pinyin[0]}</span>
                </button>
              ))
            ) : (
              <p>
                Every character you create becomes a little discovery.
                <br />
                <span>Your first one is just two tiles away.</span>
              </p>
            )}
          </div>
        </section>
      </main>
      <footer>
        <span>
          <Glyph>想</Glyph> A little play. A different way to see.
        </span>
        <span>
          Character data by{" "}
          <a
            href="https://github.com/skishore/makemeahanzi"
            target="_blank"
            rel="noreferrer"
          >
            Make Me a Hanzi ↗
          </a>
        </span>
      </footer>
      <dialog
        ref={chooser}
        onCancel={(e) => {
          e.preventDefault();
          send({ type: "cancel" });
        }}
        aria-labelledby="choose-title"
        className="game-dialog"
      >
        <div className="dialog-heading">
          <p className="eyebrow">MORE THAN ONE POSSIBILITY</p>
          <button
            className="icon-button"
            aria-label="Cancel composition"
            onClick={() => send({ type: "cancel" })}
          >
            ×
          </button>
        </div>
        <h2 id="choose-title">Which character will you make?</h2>
        <p>
          <Glyph>{selected.map((t) => t.char).join(" + ")}</Glyph> can become{" "}
          {matches.length} different characters. Choose one.
        </p>
        <div className="candidate-grid">
          {state.candidates.map((c) => (
            <button key={c} onClick={() => send({ type: "choose", char: c })}>
              <Glyph>{c}</Glyph>
              <span>{data.meta[c]?.pinyin[0]}</span>
              <small>
                {data.meta[c]?.definition || "Definition unavailable"}
              </small>
            </button>
          ))}
        </div>
        <button className="secondary" onClick={() => send({ type: "cancel" })}>
          Keep my tiles
        </button>
      </dialog>
      <dialog
        ref={helpDialog}
        className="game-dialog help-dialog"
        aria-labelledby="help-title"
        onCancel={(e) => {
          e.preventDefault();
          setHelp(false);
        }}
      >
        <div className="dialog-heading">
          <p className="eyebrow">WELCOME TO XIANG</p>
          <button
            className="icon-button"
            aria-label="Close instructions"
            onClick={() => setHelp(false)}
          >
            ×
          </button>
        </div>
        <h2 id="help-title">Characters are made of possibilities.</h2>
        <ol>
          <li>
            <strong>Take one apart.</strong> Click a character on the board. Its
            parts move to your tray. Try 想 → 相 + 心, then click 相 in the tray
            to get 木 + 目.
          </li>
          <li>
            <strong>Make something new.</strong> Select two or three tray tiles
            (use + to keep a tile intact), then Combine. If there’s more than
            one result, you choose. You can also drag one tile onto another;
            drag a selected pair onto a third tile for three-piece recipes. On
            touch screens, drag the dotted grip. Press Escape to cancel. Invalid
            combinations keep your tiles.
          </li>
          <li>
            <strong>Follow your curiosity.</strong> A character you make stays
            on the board. Split it again, learn its meaning, or try a different
            pairing.
          </li>
        </ol>
        <p>
          Explore freely, or try the timed challenge: 60 seconds, a new tile
          every 6 seconds, and a 12-tile tray. Each composition adds 3 seconds
          and 1 point, plus 1 point for a new character. A 13th tile ends the
          run—even when splitting a board character.
        </p>
        <p className="guide-note">
          These are structural dictionary relationships, not always the
          historical origins of a character. Tile order doesn’t matter. Only
          complete, supported recipes are used, including reviewed three-piece
          splits such as 森 → 木 + 木 + 木.
        </p>
        <button className="primary" onClick={() => setHelp(false)}>
          Let’s explore →
        </button>
      </dialog>
    </div>
  );
}

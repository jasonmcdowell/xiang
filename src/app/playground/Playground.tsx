"use client";

import Link from "next/link";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import { useEffect, useRef, useState } from "react";
import { STEP, type Point } from "@/lib/wobble";
import { drawConnections, drawLayers, drawMagnet } from "@/lib/wobbleDrawing";
import {
  PlaygroundWorld,
  type PhysicsMode,
  type PlaygroundAssets,
} from "@/lib/playgroundWorld";
import type { VisualStyle } from "@/lib/wobbleDrawing";
import styles from "./playground.module.css";

type Status = { phase: string; message: string; character: string };
const samples = ["想", "相", "明", "休", "好"];

export default function Playground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<PlaygroundWorld | null>(null);
  const ratioRef = useRef(1);
  const settingsRef = useRef({
    softness: 55,
    reduced: false,
    mode: "fixed" as PhysicsMode,
    visualStyle: "raised" as VisualStyle,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [softness, setSoftness] = useState(55);
  const [reduced, setReduced] = useState(false);
  const [mode, setMode] = useState<PhysicsMode>("fixed");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("raised");
  const [status, setStatus] = useState<Status>({
    phase: "whole",
    message:
      "Pull one of the mapped components outward. It will stretch before it tears free.",
    character: "想",
  });

  useEffect(() => {
    settingsRef.current = { softness, reduced, mode, visualStyle };
    const world = worldRef.current;
    if (world) {
      world.setSoftness(softness / 100);
      world.setReducedMotion(reduced);
      world.setMode(mode);
      world.setVisualStyle(visualStyle);
    }
  }, [softness, reduced, mode, visualStyle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const abort = new AbortController();
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let frame = 0;
    let previous = 0;
    let elapsed = 0;
    let manual = false;
    let observer: ResizeObserver | null = null;

    const draw = () => {
      const world = worldRef.current;
      if (!world) return;
      drawLayers(
        ctx,
        world.layers(),
        ratioRef.current,
        settingsRef.current.visualStyle,
      );
      const magnet = world.magnet();
      if (magnet)
        drawMagnet(
          ctx,
          magnet.from,
          magnet.to,
          magnet.targetFrom,
          magnet.targetTo,
          magnet.strength,
          ratioRef.current,
        );
      const connection = world.connections();
      if (connection)
        drawConnections(
          ctx,
          connection.tethers,
          connection.parent,
          connection.part,
          ratioRef.current,
        );
    };
    const publish = () => {
      const world = worldRef.current;
      if (!world) return;
      setStatus({
        phase: world.phase,
        message: world.message,
        character: world.selectedCharacter,
      });
    };
    const cancel = () => {
      const ids = worldRef.current?.pointerIds ?? [];
      worldRef.current?.cancelAll();
      for (const id of ids)
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      canvas.style.cursor = "grab";
      publish();
      draw();
    };
    const coordinates = (event: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !worldRef.current) return;
      const point = coordinates(event);
      if (!worldRef.current.pointerDown(point, event.pointerId)) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      publish();
      draw();
    };
    const move = (event: PointerEvent) => {
      const world = worldRef.current;
      if (!world) return;
      if (!world.pointerIds.includes(event.pointerId)) return;
      event.preventDefault();
      world.pointerMove(coordinates(event), event.pointerId);
      draw();
    };
    const up = (event: PointerEvent) => {
      const world = worldRef.current;
      if (!world?.pointerIds.includes(event.pointerId)) return;
      world.pointerUp(coordinates(event), event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = world.pointerIds.length ? "grabbing" : "grab";
      publish();
      draw();
    };
    const lost = (event: PointerEvent) => {
      const world = worldRef.current;
      if (!world?.pointerIds.includes(event.pointerId)) return;
      world.pointerCancel(event.pointerId);
      canvas.style.cursor = world.pointerIds.length ? "grabbing" : "grab";
      publish();
      draw();
    };
    const onKey = (event: KeyboardEvent) => {
      const world = worldRef.current;
      if (!world) return;
      if (event.key === "Escape") {
        cancel();
        return;
      }
      if (event.target !== canvas) return;
      if (event.key.toLowerCase() === "r") {
        world.reset();
        publish();
        draw();
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void stageRef.current?.requestFullscreen().catch(() => {});
      } else {
        const directions: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
          " ": [1, 0],
        };
        if (directions[event.key]) {
          event.preventDefault();
          world.nudge(...directions[event.key]);
        }
      }
    };
    const visibility = () => {
      if (document.hidden) cancel();
      previous = 0;
      elapsed = 0;
    };
    const onBlur = () => cancel();
    const onPreference = () => setReduced(media.matches);

    const snapshot = () =>
      JSON.stringify(
        worldRef.current?.snapshot() ?? {
          mode: "wobble-playground",
          character: "想",
          ready: false,
        },
      );
    const advance = (ms: number) => {
      manual = true;
      const world = worldRef.current;
      if (!world || !Number.isFinite(ms) || ms < 0) return;
      if (world.advance(ms)) publish();
      draw();
    };
    const tick = (now: number) => {
      const world = worldRef.current;
      if (!manual && !document.hidden && world) {
        elapsed += previous ? Math.min((now - previous) / 1000, 0.05) : STEP;
        while (elapsed >= STEP) {
          if (world.step()) publish();
          elapsed -= STEP;
        }
      }
      previous = now;
      draw();
      frame = requestAnimationFrame(tick);
    };

    window.render_game_to_text = snapshot;
    window.advanceTime = advance;
    media.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", lost);
    canvas.addEventListener("lostpointercapture", lost);
    const preferenceFrame = requestAnimationFrame(onPreference);

    fetch(publicAssetUrl("data/playground/scene.json"), {
      signal: abort.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Playground data unavailable");
        return response.json();
      })
      .then((assets: PlaygroundAssets) => {
        if (disposed) return;
        if (
          !assets.recipes?.length ||
          !assets.glyphs ||
          samples.some(
            (char) => !assets.recipes.some((recipe) => recipe.char === char),
          )
        )
          throw new Error("Incomplete playground data");
        const resize = () => {
          cancel();
          const rect = canvas.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const ratio = Math.min(devicePixelRatio || 1, 2);
          ratioRef.current = ratio;
          canvas.width = Math.round(rect.width * ratio);
          canvas.height = Math.round(rect.height * ratio);
          if (worldRef.current)
            worldRef.current.resize(rect.width, rect.height);
          else
            worldRef.current = new PlaygroundWorld(
              rect.width,
              rect.height,
              assets,
            );
          const world = worldRef.current;
          world.setSoftness(settingsRef.current.softness / 100);
          world.setReducedMotion(settingsRef.current.reduced);
          world.setMode(settingsRef.current.mode);
          world.setVisualStyle(settingsRef.current.visualStyle);
          publish();
          draw();
        };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
        setReady(true);
        setError(false);
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });

    return () => {
      disposed = true;
      abort.abort();
      cancel();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(preferenceFrame);
      observer?.disconnect();
      worldRef.current = null;
      media.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", lost);
      canvas.removeEventListener("lostpointercapture", lost);
      if (window.render_game_to_text === snapshot)
        delete window.render_game_to_text;
      if (window.advanceTime === advance) delete window.advanceTime;
    };
  }, [attempt]);

  const selectCharacter = (char: string) => {
    const world = worldRef.current;
    if (!world) return;
    world.reset(char);
    setStatus({ phase: world.phase, message: world.message, character: char });
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      drawLayers(
        ctx,
        world.layers(),
        ratioRef.current,
        settingsRef.current.visualStyle,
      );
      const magnet = world.magnet();
      if (magnet)
        drawMagnet(
          ctx,
          magnet.from,
          magnet.to,
          magnet.targetFrom,
          magnet.targetTo,
          magnet.strength,
          ratioRef.current,
        );
    }
  };
  const reset = () => selectCharacter(status.character);
  const nudge = () => {
    worldRef.current?.nudge();
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          想{" "}
          <span>
            xiang<span className={styles.dot}>.</span>
          </span>
        </Link>
        <span className={styles.edition}>THE PLAYGROUND / PHYSICS LAB</span>
        <Link href="/" className={styles.back}>
          Back to the game ↗
        </Link>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>A LITTLE EXPERIMENT IN FEELING</p>
        <h1>
          Pull it apart. Bring it back together<span>.</span>
        </h1>
        <p>
          Raised and Draped styles use same-size tiles. Pull the ink to stretch
          or tear while the tile stays put; keep pulling until there is room for
          both tiles. Drag a blank area of the face to move the whole character
          in Weighted mode.
        </p>
      </section>

      <section className={styles.labControls} aria-label="Playground setup">
        <div className={styles.samples}>
          <span className={styles.controlLabel}>Try a character</span>
          <div className={styles.sampleButtons}>
            {samples.map((char) => (
              <button
                key={char}
                type="button"
                disabled={!ready}
                aria-pressed={status.character === char}
                onClick={() => selectCharacter(char)}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
        <fieldset className={styles.modePicker}>
          <legend>Character weight</legend>
          <label>
            <input
              type="radio"
              name="physics-mode"
              value="fixed"
              checked={mode === "fixed"}
              onChange={() => setMode("fixed")}
            />
            Fixed <span>stays centered</span>
          </label>
          <label>
            <input
              type="radio"
              name="physics-mode"
              value="weighted"
              checked={mode === "weighted"}
              onChange={() => setMode("weighted")}
            />
            Weighted <span>moves with resistance</span>
          </label>
        </fieldset>
      </section>

      <fieldset className={styles.stylePicker}>
        <legend>Surface style</legend>
        <label>
          <input
            type="radio"
            name="visual-style"
            value="flat"
            checked={visualStyle === "flat"}
            onChange={() => setVisualStyle("flat")}
          />
          Flat <span>ink only</span>
        </label>
        <label>
          <input
            type="radio"
            name="visual-style"
            value="raised"
            checked={visualStyle === "raised"}
            onChange={() => setVisualStyle("raised")}
          />
          Raised <span>embossed</span>
        </label>
        <label>
          <input
            type="radio"
            name="visual-style"
            value="draped"
            checked={visualStyle === "draped"}
            onChange={() => setVisualStyle("draped")}
          />
          Draped <span>over the edge</span>
        </label>
      </fieldset>

      <div className={styles.stage} ref={stageRef}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label={`Physical ${status.character} playground in ${visualStyle} surface style. Raised and Draped tiles are the same size. Drag visible ink to pull a component while the tile stays in place. Drag the blank tile face to move the whole character in Weighted mode. Overlap compatible tiles, or hold ink over the compatible tile while the strokes drift into place and snap together.`}
          aria-describedby="playground-keys"
        />
        {!ready && (
          <div className={styles.loading} role="status">
            {error ? (
              <>
                <span>The character outlines couldn’t load.</span>
                <button
                  onClick={() => {
                    setError(false);
                    setAttempt((value) => value + 1);
                  }}
                >
                  Try again
                </button>
              </>
            ) : (
              "The characters are taking shape…"
            )}
          </div>
        )}
        <span className={styles.characterNote} aria-live="polite">
          <strong>{status.character}</strong> <i>{status.phase}</i>
        </span>
        <span className={styles.stageNote} aria-hidden="true">
          A little give. A little gravity.
        </span>
      </div>
      <p className={styles.liveMessage} role="status" aria-live="polite">
        {status.message}
      </p>

      <div className={styles.controls}>
        <label className={styles.softness}>
          Softness
          <input
            aria-label="Softness"
            type="range"
            min="0"
            max="100"
            value={softness}
            disabled={reduced}
            onChange={(event) => setSoftness(Number(event.target.value))}
          />
          <span>
            {reduced
              ? "Still"
              : softness < 34
                ? "Firm"
                : softness > 70
                  ? "Floppy"
                  : "Supple"}
          </span>
        </label>
        <div className={styles.actions}>
          <button disabled={!ready} onClick={nudge}>
            Give it a nudge <span aria-hidden="true">↝</span>
          </button>
          <button disabled={!ready} onClick={reset}>
            Reset <span aria-hidden="true">↺</span>
          </button>
        </div>
      </div>
      <footer className={styles.footer}>
        <p id="playground-keys">
          Raised and Draped tiles are the same size. Pull ink until the child
          tile has room beside its sibling; the parent tile stays in place. Drag
          a blank area of the face to move the whole character in Weighted mode.
          Overlap compatible tile faces, or hold ink over the compatible tile
          while strokes drift into place and snap.{" "}
          <span>
            Keyboard: arrows to nudge · R to reset · F for fullscreen · Escape
            to release
          </span>
        </p>
        <label>
          <input
            type="checkbox"
            checked={reduced}
            onChange={(event) => setReduced(event.target.checked)}
          />{" "}
          Reduce motion
        </label>
      </footer>
      <p className={styles.credit}>
        Reviewed outlines and component matches:{" "}
        <a
          href="https://github.com/skishore/makemeahanzi"
          target="_blank"
          rel="noreferrer"
        >
          Make Me a Hanzi
        </a>{" "}
        · © 1999 Arphic Technology · Freely redistributable under the{" "}
        <a href={publicAssetUrl("data/licenses/ARPHICPL.TXT")}>
          Arphic Public License
        </a>
        , without warranty.
      </p>
    </main>
  );
}

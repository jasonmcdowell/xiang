"use client";

import Link from "next/link";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import { useCallback, useEffect, useRef, useState } from "react";
import { STEP, type Point } from "@/lib/wobble";
import {
  loadPlaygroundAssets,
  loadPlaygroundDictionary,
  loadPlaygroundHsk1,
  loadPlaygroundManifest,
  type PlaygroundDictionary,
  type PlaygroundHsk1,
  type PlaygroundManifest,
} from "@/lib/playgroundAssetsClient";
import { drawConnections, drawLayers, drawMagnet } from "@/lib/wobbleDrawing";
import { PlaygroundWorld, type PhysicsMode } from "@/lib/playgroundWorld";
import type { VisualStyle } from "@/lib/wobbleDrawing";
import styles from "./playground.module.css";

type Status = {
  phase: string;
  message: string;
  character: string;
  boardPreset: "starters" | "single" | "custom";
  tileCount: number;
};
type PointerStart = {
  id: number;
  character: string;
  start: Point;
  moved: boolean;
  at: number;
};
const DOUBLE_TAP_INTERVAL_MS = 500;
const starterSamples = ["想", "相", "明", "休", "好", "林", "森"];

export default function Playground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<PlaygroundWorld | null>(null);
  const manifestRef = useRef<PlaygroundManifest | null>(null);
  const pointerStartsRef = useRef(new Map<number, PointerStart>());
  const lastTapRef = useRef<PointerStart | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ratioRef = useRef(1);
  const settingsRef = useRef({
    softness: 55,
    reduced: false,
    mode: "fixed" as PhysicsMode,
    visualStyle: "raised" as VisualStyle,
    tileRepulsion: true,
  });
  const [ready, setReady] = useState(false);
  const [samples, setSamples] = useState(starterSamples);
  const [glyphCount, setGlyphCount] = useState<number | null>(null);
  const [hskOpen, setHskOpen] = useState(false);
  const [hskVariant, setHskVariant] = useState<"simplified" | "traditional">(
    "simplified",
  );
  const [hskCharacters, setHskCharacters] = useState<PlaygroundHsk1 | null>(
    null,
  );
  const [hskLoading, setHskLoading] = useState(false);
  const [hskError, setHskError] = useState("");
  const [hskAttempt, setHskAttempt] = useState(0);
  const [characterInput, setCharacterInput] = useState("");
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [softness, setSoftness] = useState(55);
  const [reduced, setReduced] = useState(false);
  const [mode, setMode] = useState<PhysicsMode>("fixed");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("raised");
  const [tileRepulsion, setTileRepulsion] = useState(true);
  const [focusedCharacter, setFocusedCharacter] = useState("想");
  const [dictionary, setDictionary] = useState<PlaygroundDictionary | null>(
    null,
  );
  const [status, setStatus] = useState<Status>({
    phase: "whole",
    message:
      "Five starters are ready. Pull a component away from any character to explore it.",
    character: "想",
    boardPreset: "starters",
    tileCount: 5,
  });

  const unlockAudio = useCallback(() => {
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      const context = audioContextRef.current ?? new AudioContextConstructor();
      audioContextRef.current = context;
      if (context.state !== "running") void context.resume().catch(() => {});
    } catch {
      // Audio is an enhancement; blocked or unavailable audio never blocks play.
    }
  }, []);

  const playTearPop = useCallback(() => {
    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(560, now);
    oscillator.frequency.exponentialRampToValueAtTime(155, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.125);
  }, []);

  const handleWorldEvents = useCallback(
    (world: PlaygroundWorld) => {
      for (const event of world.takeEvents()) {
        setFocusedCharacter(event.character);
        if (event.type === "tear") playTearPop();
      }
    },
    [playTearPop],
  );

  useEffect(() => {
    if (!hskOpen || hskCharacters) return;
    let disposed = false;
    setHskLoading(true);
    setHskError("");
    void loadPlaygroundHsk1()
      .then((catalog) => {
        if (!disposed) setHskCharacters(catalog);
      })
      .catch(() => {
        if (!disposed)
          setHskError("The HSK 1 character list could not be loaded.");
      })
      .finally(() => {
        if (!disposed) setHskLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [hskOpen, hskCharacters, hskAttempt]);

  useEffect(() => {
    settingsRef.current = {
      softness,
      reduced,
      mode,
      visualStyle,
      tileRepulsion,
    };
    const world = worldRef.current;
    if (world) {
      world.setSoftness(softness / 100);
      world.setReducedMotion(reduced);
      world.setMode(mode);
      world.setVisualStyle(visualStyle);
      world.setTileRepulsion(tileRepulsion);
    }
  }, [softness, reduced, mode, visualStyle, tileRepulsion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let frame = 0;
    let previous = 0;
    let elapsed = 0;
    let manual = false;
    let observer: ResizeObserver | null = null;
    let lastAssetSignature = "";
    manifestRef.current = null;

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
        boardPreset: world.boardPreset,
        tileCount: world.tileCount,
      });
    };
    const requestSceneAssets = () => {
      const world = worldRef.current;
      const manifest = manifestRef.current;
      if (!world || !manifest) return;
      const characters = world.charactersOnBoard();
      const compositions = world.compositionAssetCandidates();
      const signature = `${[...characters].sort().join("")}|${[...compositions].sort().join("")}`;
      if (signature === lastAssetSignature) return;
      lastAssetSignature = signature;
      const waiting = [...characters, ...compositions].filter(
        (character) =>
          manifest.recipeCharacters.includes(character) &&
          !world.hasRecipeFor(character),
      );
      if (waiting.length)
        setStatus((current) => ({
          ...current,
          message: `Loading component strokes for ${[...new Set(waiting)].join(", ")}…`,
        }));
      void loadPlaygroundAssets(characters, manifest, compositions)
        .then((assets) => {
          if (disposed || worldRef.current !== world) return;
          world.registerAssets(assets);
          publish();
          draw();
        })
        .catch(() => {
          if (disposed) return;
          setStatus((current) => ({
            ...current,
            message:
              "Some character outlines could not be loaded. Try selecting that character again.",
          }));
        });
    };
    const cancel = () => {
      const ids = worldRef.current?.pointerIds ?? [];
      worldRef.current?.cancelAll();
      pointerStartsRef.current.clear();
      lastTapRef.current = null;
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
      unlockAudio();
      const point = coordinates(event);
      const world = worldRef.current;
      if (!world.pointerDown(point, event.pointerId)) return;
      const target = world.pointerTarget(event.pointerId);
      if (target) {
        setFocusedCharacter(target.character);
        pointerStartsRef.current.set(event.pointerId, {
          id: target.id,
          character: target.character,
          start: point,
          moved: false,
          at: performance.now(),
        });
      }
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      publish();
      requestSceneAssets();
      draw();
    };
    const move = (event: PointerEvent) => {
      const world = worldRef.current;
      if (!world) return;
      if (!world.pointerIds.includes(event.pointerId)) return;
      const start = pointerStartsRef.current.get(event.pointerId);
      const point = coordinates(event);
      if (
        start &&
        Math.hypot(point.x - start.start.x, point.y - start.start.y) > 10
      )
        start.moved = true;
      event.preventDefault();
      world.pointerMove(point, event.pointerId);
      requestSceneAssets();
      draw();
    };
    const up = (event: PointerEvent) => {
      const world = worldRef.current;
      if (!world?.pointerIds.includes(event.pointerId)) return;
      const point = coordinates(event);
      const start = pointerStartsRef.current.get(event.pointerId);
      const isTap =
        !!start &&
        !start.moved &&
        Math.hypot(point.x - start.start.x, point.y - start.start.y) <= 12;
      world.pointerUp(point, event.pointerId);
      pointerStartsRef.current.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = world.pointerIds.length ? "grabbing" : "grab";
      requestSceneAssets();
      if (isTap && start) {
        const previous = lastTapRef.current;
        const isDoubleTap =
          previous?.id === start.id &&
          previous.character === start.character &&
          start.at >= previous.at &&
          start.at - previous.at <= DOUBLE_TAP_INTERVAL_MS &&
          Math.hypot(
            previous.start.x - start.start.x,
            previous.start.y - start.start.y,
          ) <= 40;
        if (isDoubleTap) {
          lastTapRef.current = null;
          world.unfoldTile(start.id);
          handleWorldEvents(world);
          requestSceneAssets();
        } else
          lastTapRef.current = {
            ...start,
            at: performance.now(),
          };
      } else lastTapRef.current = null;
      publish();
      draw();
    };
    const lost = (event: PointerEvent) => {
      const world = worldRef.current;
      if (!world?.pointerIds.includes(event.pointerId)) return;
      world.pointerCancel(event.pointerId);
      pointerStartsRef.current.delete(event.pointerId);
      lastTapRef.current = null;
      handleWorldEvents(world);
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
        setFocusedCharacter(world.selectedCharacter);
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
      handleWorldEvents(world);
      requestSceneAssets();
      draw();
    };
    const tick = (now: number) => {
      const world = worldRef.current;
      if (!manual && !document.hidden && world) {
        elapsed += previous ? Math.min((now - previous) / 1000, 0.05) : STEP;
        while (elapsed >= STEP) {
          if (world.step()) publish();
          handleWorldEvents(world);
          requestSceneAssets();
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

    void loadPlaygroundDictionary()
      .then((entries) => {
        if (!disposed) setDictionary(entries);
      })
      .catch(() => {
        if (!disposed) setDictionary({});
      });

    loadPlaygroundManifest()
      .then(async (manifest) => {
        if (disposed) return null;
        manifestRef.current = manifest;
        setSamples(manifest.sampleCharacters);
        setGlyphCount(manifest.glyphCount);
        if (
          manifest.defaultCharacters.length !== 5 ||
          manifest.defaultCharacters.some(
            (character) => !manifest.recipeCharacters.includes(character),
          )
        )
          throw new Error("Incomplete playground character catalog");
        return loadPlaygroundAssets(manifest.defaultCharacters, manifest);
      })
      .then((assets) => {
        if (!assets) return;
        if (disposed) return;
        if (!assets.recipes?.length || !assets.glyphs)
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
          world.setTileRepulsion(settingsRef.current.tileRepulsion);
          publish();
          draw();
        };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
        requestSceneAssets();
        setReady(true);
        setError(false);
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });

    return () => {
      disposed = true;
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
  }, [attempt, handleWorldEvents, unlockAudio]);

  const selectCharacter = async (char: string) => {
    const world = worldRef.current;
    const manifest = manifestRef.current;
    if (!world || !manifest) return;
    setSelectionBusy(true);
    setSelectionError("");
    try {
      const assets = await loadPlaygroundAssets([char], manifest);
      if (worldRef.current !== world) return;
      world.registerAssets(assets);
      world.reset(char);
    } catch {
      setSelectionError(
        `No usable drawing data was found for ${char}. Try another dictionary character.`,
      );
      setSelectionBusy(false);
      return;
    }
    setSelectionBusy(false);
    setFocusedCharacter(char);
    setStatus({
      phase: world.phase,
      message: world.message,
      character: char,
      boardPreset: world.boardPreset,
      tileCount: world.tileCount,
    });
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
  const addCharacterToBoard = async (
    value = characterInput,
    clearInput = false,
  ) => {
    const character = value.trim();
    if (Array.from(character).length !== 1) {
      setSelectionError("Enter one Chinese character.");
      return;
    }
    const world = worldRef.current;
    const manifest = manifestRef.current;
    if (!world || !manifest) return;
    setSelectionBusy(true);
    setSelectionError("");
    try {
      const assets = await loadPlaygroundAssets([character], manifest);
      if (worldRef.current !== world) return;
      world.registerAssets(assets);
      const result = world.addCharacter(character);
      if (result === "added") setFocusedCharacter(character);
      if (result === "added" && clearInput) setCharacterInput("");
      setStatus({
        phase: world.phase,
        message: world.message,
        character: world.selectedCharacter,
        boardPreset: world.boardPreset,
        tileCount: world.tileCount,
      });
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
    } catch {
      setSelectionError(
        `No usable drawing data was found for ${character}. Try another dictionary character.`,
      );
    } finally {
      setSelectionBusy(false);
    }
  };
  const submitCharacter = () => {
    const character = characterInput.trim();
    if (Array.from(character).length !== 1) {
      setSelectionError("Enter one Chinese character.");
      return;
    }
    void selectCharacter(character);
  };
  const selectStarters = () => {
    const world = worldRef.current;
    if (!world) return;
    world.resetStarters();
    setFocusedCharacter("想");
    setSelectionError("");
    setStatus({
      phase: world.phase,
      message: world.message,
      character: world.selectedCharacter,
      boardPreset: world.boardPreset,
      tileCount: world.tileCount,
    });
  };
  const reset = () => {
    const world = worldRef.current;
    if (!world) return;
    world.reset();
    setFocusedCharacter(world.selectedCharacter);
    setStatus({
      phase: world.phase,
      message: world.message,
      character: world.selectedCharacter,
      boardPreset: world.boardPreset,
      tileCount: world.tileCount,
    });
  };
  const nudge = () => {
    worldRef.current?.nudge();
  };
  const boardDescription =
    status.boardPreset === "starters"
      ? `${status.tileCount} starter characters`
      : status.boardPreset === "custom"
        ? `${status.tileCount} custom characters`
        : status.character;
  const focusInfo = dictionary?.[focusedCharacter];

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
      <div className={styles.workspace}>
        <section
          className={styles.boardColumn}
          aria-label="Character gameboard"
        >
          <section className={styles.intro}>
            <h1>
              Pull it apart. Bring it back together<span>.</span>
            </h1>
          </section>

          <div className={styles.stage} ref={stageRef}>
            <canvas
              ref={canvasRef}
              tabIndex={0}
              role="application"
              aria-label={`Physical ${boardDescription} playground in ${visualStyle} surface style. Drag visible ink to pull a component while its source tile stays in place. Once it tears free, its new tile follows the held ink until release. Drag a blank tile face to move the whole character. Overlap compatible tile faces, or hold ink over the compatible tile, to recombine.`}
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
              <strong>
                {status.boardPreset !== "single"
                  ? `${status.tileCount} tiles`
                  : status.character}
              </strong>{" "}
              <i>{status.phase}</i>
            </span>
            <span className={styles.stageNote} aria-hidden="true">
              A little give. A little gravity.
            </span>
          </div>
          <p className={styles.liveMessage} role="status" aria-live="polite">
            {status.message}
          </p>
        </section>

        <aside className={styles.sidebar} aria-label="Playground controls">
          <section className={styles.instructions}>
            <p className={styles.panelLabel}>HOW TO PLAY</p>
            <h2>Pull, place, recombine</h2>
            <p>
              Start with five characters. Pull a mapped stroke group away until
              it becomes its own tile. Hold ink over a compatible tile or
              overlap the tiles to guide the strokes back together.
            </p>
            <p>
              Double-tap a character or one of its strokes to unfold one
              supported step.
            </p>
            <p>
              Drag a blank tile face to move the whole character. Fixed keeps it
              centered; Weighted gives it more movement.
            </p>
            <p>
              Add any drawable dictionary character to keep building the board,
              or explore it alone to replace the current scene.
            </p>
          </section>

          <section
            className={styles.focusCard}
            aria-label={`Character details for ${focusedCharacter}`}
            aria-live="polite"
          >
            <span className={styles.focusCharacter} aria-hidden="true">
              {focusedCharacter}
            </span>
            <div className={styles.focusDetails}>
              <span className={styles.focusLabel}>IN FOCUS</span>
              <p className={styles.focusPinyin}>
                {focusInfo?.pinyin.join(" · ") ||
                  (dictionary
                    ? "Pronunciation unavailable"
                    : "Loading pronunciation…")}
              </p>
              <p className={styles.focusDefinition}>
                {focusInfo?.definition ||
                  (dictionary
                    ? "Definition unavailable"
                    : "Loading definition…")}
              </p>
            </div>
          </section>

          <div className={styles.sidebarScroll}>
            <section className={styles.boardPicker} aria-label="Starting board">
              <span className={styles.controlLabel}>Starting board</span>
              <button
                className={styles.starterButton}
                type="button"
                disabled={!ready}
                aria-pressed={status.boardPreset === "starters"}
                onClick={selectStarters}
              >
                Five starters
              </button>
            </section>

            <section className={styles.samples} aria-label="Try one character">
              <span className={styles.controlLabel}>Try a character</span>
              <div className={styles.sampleButtons}>
                {samples.map((char) => (
                  <button
                    key={char}
                    type="button"
                    disabled={!ready || selectionBusy}
                    aria-pressed={
                      status.boardPreset === "single" &&
                      status.character === char
                    }
                    onClick={() => selectCharacter(char)}
                  >
                    {char}
                  </button>
                ))}
              </div>
              <form
                className={styles.characterForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitCharacter();
                }}
              >
                <label htmlFor="playground-character">
                  Any dictionary character
                </label>
                <div>
                  <input
                    id="playground-character"
                    value={characterInput}
                    maxLength={2}
                    autoComplete="off"
                    disabled={!ready || selectionBusy}
                    onChange={(event) => setCharacterInput(event.target.value)}
                    aria-describedby="playground-character-help"
                  />
                  <button type="submit" disabled={!ready || selectionBusy}>
                    {selectionBusy ? "Loading…" : "Explore"}
                  </button>
                  <button
                    type="button"
                    aria-label="Add to board"
                    disabled={!ready || selectionBusy}
                    onClick={() =>
                      void addCharacterToBoard(characterInput, true)
                    }
                  >
                    Add
                  </button>
                </div>
                <p
                  id="playground-character-help"
                  role="status"
                  aria-live="polite"
                >
                  {selectionError ||
                    `${glyphCount?.toLocaleString() ?? "Thousands of"} glyph outlines load only when needed.`}
                </p>
              </form>
            </section>

            <section className={styles.hskPicker} aria-label="HSK 1 characters">
              <button
                className={styles.hskToggle}
                type="button"
                aria-expanded={hskOpen}
                aria-controls="playground-hsk1-list"
                onClick={() => setHskOpen((open) => !open)}
              >
                <span>HSK 1 character set</span>
                <span aria-hidden="true">{hskOpen ? "−" : "+"}</span>
              </button>
              {hskOpen && (
                <div className={styles.hskContents} id="playground-hsk1-list">
                  <div
                    className={styles.hskVariants}
                    role="group"
                    aria-label="Writing system"
                  >
                    <button
                      type="button"
                      aria-pressed={hskVariant === "simplified"}
                      onClick={() => setHskVariant("simplified")}
                    >
                      Simplified
                    </button>
                    <button
                      type="button"
                      aria-pressed={hskVariant === "traditional"}
                      onClick={() => setHskVariant("traditional")}
                    >
                      Traditional
                    </button>
                  </div>
                  {hskLoading ? (
                    <p className={styles.hskNote} role="status">
                      Loading HSK 1…
                    </p>
                  ) : hskError ? (
                    <div className={styles.hskError} role="status">
                      <span>{hskError}</span>
                      <button
                        type="button"
                        onClick={() => setHskAttempt((attempt) => attempt + 1)}
                      >
                        Retry
                      </button>
                    </div>
                  ) : hskCharacters ? (
                    <>
                      <p className={styles.hskNote} role="status">
                        {hskCharacters.sets[hskVariant].characters.length}{" "}
                        drawable characters
                        {hskCharacters.sets[hskVariant].unavailableCharacters
                          .length > 0 &&
                          " · " +
                            hskCharacters.sets[hskVariant].unavailableCharacters
                              .length +
                            " without stroke outlines"}
                      </p>
                      <div
                        key={hskVariant}
                        className={styles.hskCharacters}
                        role="group"
                        aria-label={
                          (hskVariant === "simplified"
                            ? "Simplified"
                            : "Traditional") + " HSK 1 characters"
                        }
                      >
                        {hskCharacters.sets[hskVariant].characters.map(
                          (char) => (
                            <button
                              key={char}
                              type="button"
                              aria-label={"Add " + char + " from HSK 1"}
                              disabled={!ready || selectionBusy}
                              onClick={() => void addCharacterToBoard(char)}
                            >
                              {char}
                            </button>
                          ),
                        )}
                      </div>
                      <p className={styles.hskNote}>
                        Click a character to add it to the current board. HSK
                        2.0 list.{" "}
                        <a
                          href={hskCharacters.source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source
                        </a>{" "}
                        ·{" "}
                        <a href={publicAssetUrl(hskCharacters.license)}>
                          MIT license
                        </a>
                      </p>
                    </>
                  ) : null}
                </div>
              )}
            </section>

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

            <fieldset className={styles.modePicker}>
              <legend>Tile interaction</legend>
              <label>
                <input
                  type="checkbox"
                  checked={tileRepulsion}
                  onChange={(event) => setTileRepulsion(event.target.checked)}
                />
                Tile repulsion <span>loose faces nudge apart</span>
              </label>
            </fieldset>

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

            <section className={styles.controls} aria-label="Physics controls">
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
            </section>

            <footer className={styles.footer}>
              <label>
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(event) => setReduced(event.target.checked)}
                />{" "}
                Reduce motion
              </label>
              <p id="playground-keys">
                Keyboard: arrows to nudge · R to reset · F for fullscreen ·
                Escape to release.
              </p>
            </footer>
          </div>
        </aside>
      </div>
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

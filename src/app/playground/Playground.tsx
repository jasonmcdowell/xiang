"use client";

import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import WritingSystemPicker from "@/components/WritingSystemPicker";
import { useLanguage } from "@/components/LanguageProvider";
import { translateRuntimeText } from "@/lib/language";
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
import type { PlaygroundAssets } from "@/lib/playgroundWorld";
import { drawConnections, drawLayers, drawMagnet } from "@/lib/wobbleDrawing";
import {
  advanceDiscoveryClock,
  createDiscoveryRun,
  discoveryScore,
  drawCharacter,
  finishDiscoveryRun,
  recordDiscoveryArrival,
  recordDiscoveryBoard,
  startDiscoveryRun,
  type DiscoveryCapacity,
  type DiscoveryCollection,
  type DiscoveryRun,
} from "@/lib/discoveryRun";
import {
  PlaygroundWorld,
  type ArrangeMode,
  type PhysicsMode,
} from "@/lib/playgroundWorld";
import PlaygroundBoard, {
  DiscoveryBoard,
  type BoardMaterial,
} from "./PlaygroundBoard";
import type { VisualStyle } from "@/lib/wobbleDrawing";
import type { WritingSystem } from "@/lib/indicesClient";
import styles from "./playground.module.css";

type Status = {
  phase: string;
  message: string;
  character: string;
  boardPreset: "starters" | "single" | "custom" | "cells";
  tileCount: number;
  dragging?: boolean;
  animatingTiles?: boolean;
};
type PlaygroundTab = "playground" | "discovery";
type PointerStart = {
  id: number;
  character: string;
  start: Point;
  moved: boolean;
  at: number;
};
const DOUBLE_TAP_INTERVAL_MS = 500;
const starterSamples = ["想", "相", "明", "休", "好", "林", "森"];
const discoveryCapacities: DiscoveryCapacity[] = [9, 16, 25, 36];

function mergeAssets(
  base: PlaygroundAssets | null,
  extra: PlaygroundAssets,
): PlaygroundAssets {
  if (!base)
    return {
      glyphs: { ...extra.glyphs },
      recipes: [...extra.recipes],
      compositionParents: { ...extra.compositionParents },
    };
  Object.assign(base.glyphs, extra.glyphs);
  const recipes = new Map(base.recipes.map((recipe) => [recipe.char, recipe]));
  for (const recipe of extra.recipes) recipes.set(recipe.char, recipe);
  base.recipes = [...recipes.values()];
  if (extra.compositionParents)
    base.compositionParents = extra.compositionParents;
  return base;
}

function cloneAssets(assets: PlaygroundAssets): PlaygroundAssets {
  return {
    glyphs: { ...assets.glyphs },
    recipes: [...assets.recipes],
    compositionParents: { ...assets.compositionParents },
  };
}

function mapCompositionParents(
  index: Record<string, string[]>,
  characterMap: Record<string, string>,
) {
  const mapped: Record<string, Set<string>> = {};
  for (const [pair, parents] of Object.entries(index)) {
    const key = pair
      .split("|")
      .map((character) => characterMap[character] ?? character)
      .sort()
      .join("|");
    const values = (mapped[key] ??= new Set());
    for (const parent of parents) values.add(characterMap[parent] ?? parent);
  }
  return Object.fromEntries(
    Object.entries(mapped).map(([key, values]) => [key, [...values].sort()]),
  );
}

function convertText(value: string, characterMap: Record<string, string>) {
  return Array.from(
    value,
    (character) => characterMap[character] ?? character,
  ).join("");
}

export default function Playground() {
  const { t, language, writingSystem, playgroundCharacterVariants } =
    useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<PlaygroundWorld | null>(null);
  const playgroundWorldRef = useRef<PlaygroundWorld | null>(null);
  const discoveryWorldRef = useRef<PlaygroundWorld | null>(null);
  const assetsRef = useRef<PlaygroundAssets | null>(null);
  const manifestRef = useRef<PlaygroundManifest | null>(null);
  const activeTabRef = useRef<PlaygroundTab>("playground");
  const discoveryRunRef = useRef<DiscoveryRun | null>(null);
  const arrivalQueueRef = useRef<Promise<void>>(Promise.resolve());
  const runGenerationRef = useRef(0);
  const writingMapRef = useRef<Record<string, string>>({});
  const previousWritingSystemRef = useRef<WritingSystem>("simplified");
  const scriptSwitchingRef = useRef(false);
  const focusTileRef = useRef<(character: string, id: number | null) => void>(
    () => {},
  );
  const displayedArrivalSecondRef = useRef<number | null>(null);
  const keepArrangePendingRef = useRef(new Set<PlaygroundWorld>());
  const tileSoundTimersRef = useRef<number[]>([]);
  const pointerStartsRef = useRef(new Map<number, PointerStart>());
  const lastTapRef = useRef<PointerStart | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const tearSoundEnabledRef = useRef(true);
  const ratioRef = useRef(1);
  const settingsRef = useRef({
    softness: 55,
    reduced: false,
    mode: "fixed" as PhysicsMode,
    visualStyle: "raised" as VisualStyle,
    tileRepulsion: true,
    snapToGrid: false,
    arrangeMode: "one-by-one" as ArrangeMode,
    keepArranged: false,
    highlightedTileIds: new Set<number>(),
  });
  const [ready, setReady] = useState(false);
  const [gameTab, setGameTab] = useState<PlaygroundTab>("playground");
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
  const [scriptBusy, setScriptBusy] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [softness, setSoftness] = useState(55);
  const [reduced, setReduced] = useState(false);
  const [mode, setMode] = useState<PhysicsMode>("weighted");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("raised");
  const [boardMaterial, setBoardMaterial] = useState<BoardMaterial>("bamboo");
  const [tileRepulsion, setTileRepulsion] = useState(true);
  const [tearSoundEnabled, setTearSoundEnabled] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [keepArranged, setKeepArranged] = useState(false);
  const [discoveryCollection, setDiscoveryCollection] =
    useState<DiscoveryCollection>("playground");
  const [discoveryCapacity, setDiscoveryCapacity] =
    useState<DiscoveryCapacity>(16);
  const [discoveryRun, setDiscoveryRun] = useState<DiscoveryRun | null>(null);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryStarting, setDiscoveryStarting] = useState(false);
  const [arrangeMode, setArrangeMode] = useState<ArrangeMode>("one-by-one");
  const [focusedTileId, setFocusedTileId] = useState<number | null>(null);
  const focusedTileIdRef = useRef<number | null>(null);
  const [hintsVisible, setHintsVisible] = useState(false);
  const [hintedTileIds, setHintedTileIds] = useState<number[]>([]);
  const [focusedCharacter, setFocusedCharacter] = useState("想");
  const focusedCharacterRef = useRef(focusedCharacter);
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
  const samplesRef = useRef(samples);
  const statusRef = useRef(status);

  samplesRef.current = samples;
  focusedCharacterRef.current = focusedCharacter;
  statusRef.current = status;
  writingMapRef.current = playgroundCharacterVariants?.[writingSystem] ?? {};

  const publishDiscoveryRun = useCallback((run: DiscoveryRun | null) => {
    discoveryRunRef.current = run;
    setDiscoveryRun(run);
  }, []);

  const registerAssetsEverywhere = useCallback((assets: PlaygroundAssets) => {
    const currentAssets = {
      ...assets,
      compositionParents: mapCompositionParents(
        assets.compositionParents ?? {},
        writingMapRef.current,
      ),
    };
    assetsRef.current = mergeAssets(assetsRef.current, currentAssets);
    for (const world of new Set([
      playgroundWorldRef.current,
      discoveryWorldRef.current,
    ]))
      world?.registerAssets(currentAssets);
  }, []);

  const syncDiscoveryBoard = useCallback(
    (world: PlaygroundWorld) => {
      if (world !== discoveryWorldRef.current) return;
      const run = discoveryRunRef.current;
      if (!run || run.phase !== "running") return;
      const observed = recordDiscoveryBoard(run, world.charactersOnBoard());
      publishDiscoveryRun(finishDiscoveryRun(observed, world.tileCount));
    },
    [publishDiscoveryRun],
  );

  const applyKeepArrange = useCallback((world: PlaygroundWorld) => {
    if (!keepArrangePendingRef.current.has(world)) return;
    if (!settingsRef.current.keepArranged) {
      keepArrangePendingRef.current.delete(world);
      return;
    }
    if (world.isManipulating || world.isAnimatingTiles) return;
    keepArrangePendingRef.current.delete(world);
    if (!world.arrangeTiles(settingsRef.current.arrangeMode)) return;
    if (worldRef.current === world)
      setStatus((current) => ({
        ...current,
        dragging: false,
        animatingTiles: world.isAnimatingTiles,
        tileCount: world.tileCount,
      }));
  }, []);

  const requestKeepArrange = useCallback(
    (world: PlaygroundWorld) => {
      if (!settingsRef.current.keepArranged) return;
      keepArrangePendingRef.current.add(world);
      applyKeepArrange(world);
    },
    [applyKeepArrange],
  );

  useEffect(() => {
    const characterMap = playgroundCharacterVariants?.[writingSystem];
    if (
      !ready ||
      !characterMap ||
      previousWritingSystemRef.current === writingSystem
    )
      return;
    previousWritingSystemRef.current = writingSystem;
    let cancelled = false;
    scriptSwitchingRef.current = true;
    setScriptBusy(true);

    const switchTiles = async () => {
      const manifest = manifestRef.current;
      if (!manifest) return;
      const worlds = [
        playgroundWorldRef.current,
        discoveryWorldRef.current,
      ].filter((world): world is PlaygroundWorld => world !== null);
      const converted: Record<string, string> = {};
      const preload = async (sources: string[]) => {
        for (const source of new Set(sources)) {
          const target = characterMap[source] ?? source;
          if (source === target || converted[source]) continue;
          if (
            worlds.some(
              (world) =>
                world.hasRecipeFor(source) &&
                !manifest.recipeCharacters.includes(target),
            )
          )
            continue;
          try {
            const assets = await loadPlaygroundAssets([target], manifest);
            if (cancelled) return;
            registerAssetsEverywhere(assets);
            converted[source] = target;
          } catch {
            // Keep this tile in its current script if the variant has no outline.
          }
        }
      };

      const boardCharacters = () =>
        worlds.flatMap((world) => world.charactersOnBoard());
      await preload([
        ...boardCharacters(),
        ...samplesRef.current,
        focusedCharacterRef.current,
        statusRef.current.character,
      ]);
      while (
        !cancelled &&
        worlds.some((world) => world.isManipulating || world.isAnimatingTiles)
      )
        await new Promise((resolve) => window.setTimeout(resolve, 60));
      if (cancelled) return;

      // A tear can finish while a script switch is waiting for the held stroke.
      await preload(boardCharacters());
      if (cancelled) return;
      for (const world of worlds) world.convertCharacters(converted);

      setSamples((current) =>
        current.map((character) => converted[character] ?? character),
      );
      setCharacterInput((current) => converted[current] ?? current);
      setFocusedCharacter((current) => converted[current] ?? current);
      setStatus((current) => ({
        ...current,
        character: converted[current.character] ?? current.character,
        message: convertText(current.message, converted),
      }));
      const run = discoveryRunRef.current;
      if (run) {
        const toCurrentScript = (character: string) =>
          characterMap[character] ?? character;
        publishDiscoveryRun({
          ...run,
          drawCharacters: [...new Set(run.drawCharacters.map(toCurrentScript))],
          discoveries: [
            ...new Set(run.discoveries.map(toCurrentScript)),
          ].sort(),
        });
      }
      const activeWorld = worldRef.current;
      const focusId = focusedTileIdRef.current;
      if (activeWorld && focusId !== null) {
        const focused = activeWorld
          .snapshot()
          .characters.find((character) => character.id === focusId);
        if (focused) focusTileRef.current(focused.char, focused.id);
      }
    };

    void switchTiles().finally(() => {
      if (cancelled) return;
      scriptSwitchingRef.current = false;
      setScriptBusy(false);
    });
    return () => {
      cancelled = true;
      scriptSwitchingRef.current = false;
      setScriptBusy(false);
    };
  }, [
    writingSystem,
    playgroundCharacterVariants,
    ready,
    registerAssetsEverywhere,
    publishDiscoveryRun,
  ]);

  const enqueueDiscoveryArrivals = useCallback(
    (count: number) => {
      for (let index = 0; index < count; index++) {
        const generation = runGenerationRef.current;
        arrivalQueueRef.current = arrivalQueueRef.current.then(async () => {
          if (generation !== runGenerationRef.current) return;
          const world = discoveryWorldRef.current;
          const manifest = manifestRef.current;
          if (!world || !manifest) return;
          for (let attemptIndex = 0; attemptIndex < 12; attemptIndex++) {
            const current = discoveryRunRef.current;
            if (
              generation !== runGenerationRef.current ||
              !current ||
              current.phase !== "running"
            )
              return;
            const character = drawCharacter(current.drawCharacters);
            if (!character) return;
            try {
              const assets = await loadPlaygroundAssets([character], manifest);
              if (generation !== runGenerationRef.current) return;
              registerAssetsEverywhere(assets);
            } catch {
              continue;
            }
            while (world.isManipulating || world.isAnimatingTiles) {
              if (discoveryRunRef.current?.phase !== "running") return;
              await new Promise((resolve) => window.setTimeout(resolve, 80));
            }
            const result = world.addCharacter(character);
            if (result === "busy") {
              attemptIndex--;
              await new Promise((resolve) => window.setTimeout(resolve, 80));
              continue;
            }
            if (result === "added") {
              requestKeepArrange(world);
              const latest = discoveryRunRef.current;
              if (!latest || latest.phase !== "running") return;
              const observed = recordDiscoveryBoard(
                recordDiscoveryArrival(latest),
                world.charactersOnBoard(),
              );
              publishDiscoveryRun(
                finishDiscoveryRun(observed, world.tileCount),
              );
              if (worldRef.current === world)
                setStatus((previous) => ({
                  ...previous,
                  tileCount: world.tileCount,
                  character: world.selectedCharacter,
                  boardPreset: world.boardPreset,
                  message: "A new character arrived.",
                }));
              return;
            }
            const latest = discoveryRunRef.current;
            if (latest)
              publishDiscoveryRun(finishDiscoveryRun(latest, world.tileCount));
            return;
          }
          setDiscoveryError(
            "A tile could not be loaded from this collection. The run is still going.",
          );
        });
      }
    },
    [publishDiscoveryRun, registerAssetsEverywhere, requestKeepArrange],
  );

  const advanceRunClock = useCallback(
    (milliseconds: number) => {
      const run = discoveryRunRef.current;
      if (!run || run.phase !== "running") return;
      const advanced = advanceDiscoveryClock(run, milliseconds);
      discoveryRunRef.current = advanced.run;
      const nextSecond = Math.ceil(
        (advanced.run.intervalMs - advanced.run.elapsedMs) / 1000,
      );
      if (
        advanced.arrivalsDue ||
        displayedArrivalSecondRef.current !== nextSecond
      ) {
        displayedArrivalSecondRef.current = nextSecond;
        setDiscoveryRun(advanced.run);
      }
      if (advanced.arrivalsDue) enqueueDiscoveryArrivals(advanced.arrivalsDue);
    },
    [enqueueDiscoveryArrivals],
  );

  const focusTile = useCallback((character: string, id: number | null) => {
    focusedTileIdRef.current = id;
    setFocusedCharacter(character);
    setFocusedTileId(id);
    setHintsVisible(false);
    setHintedTileIds([]);
    settingsRef.current.highlightedTileIds.clear();
  }, []);
  focusTileRef.current = focusTile;

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
    if (!context) return;
    const now = context.currentTime;
    const click = context.createOscillator();
    const clickGain = context.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(1500, now);
    click.frequency.exponentialRampToValueAtTime(520, now + 0.022);
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.13, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    click.connect(clickGain);
    clickGain.connect(context.destination);
    click.start(now);
    click.stop(now + 0.04);

    const bubble = context.createOscillator();
    const bubbleGain = context.createGain();
    bubble.type = "sine";
    bubble.frequency.setValueAtTime(340, now + 0.008);
    bubble.frequency.exponentialRampToValueAtTime(1040, now + 0.105);
    bubble.frequency.exponentialRampToValueAtTime(820, now + 0.145);
    bubbleGain.gain.setValueAtTime(0.0001, now);
    bubbleGain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
    bubbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    bubble.connect(bubbleGain);
    bubbleGain.connect(context.destination);
    bubble.start(now);
    bubble.stop(now + 0.17);
  }, []);

  const playTileClack = useCallback(() => {
    const context = audioContextRef.current;
    if (!context) return;
    const now = context.currentTime;
    const pitch = 290 + Math.random() * 110;
    const click = context.createOscillator();
    const clickGain = context.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(1240 + Math.random() * 300, now);
    click.frequency.exponentialRampToValueAtTime(460, now + 0.025);
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.08, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    click.connect(clickGain);
    clickGain.connect(context.destination);
    click.start(now);
    click.stop(now + 0.045);

    const body = context.createOscillator();
    const bodyGain = context.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(pitch, now);
    body.frequency.exponentialRampToValueAtTime(pitch * 0.56, now + 0.09);
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.09, now + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    body.connect(bodyGain);
    bodyGain.connect(context.destination);
    body.start(now);
    body.stop(now + 0.12);
  }, []);

  const playShuffleClacks = useCallback(
    (tileCount: number) => {
      for (const timer of tileSoundTimersRef.current)
        window.clearTimeout(timer);
      tileSoundTimersRef.current = [];
      const clackCount = Math.min(9, Math.max(3, tileCount));
      for (let index = 0; index < clackCount; index++) {
        const timer = window.setTimeout(() => {
          playTileClack();
          tileSoundTimersRef.current = tileSoundTimersRef.current.filter(
            (pending) => pending !== timer,
          );
        }, index * 105);
        tileSoundTimersRef.current.push(timer);
      }
    },
    [playTileClack],
  );

  const handleWorldEvents = useCallback(
    (world: PlaygroundWorld) => {
      const events = world.takeEvents();
      if (events.length) {
        syncDiscoveryBoard(world);
        requestKeepArrange(world);
      }
      for (const event of events) {
        const characters = world.snapshot().characters;
        const focused = [...characters]
          .reverse()
          .find((object) => object.char === event.character);
        focusTile(event.character, focused?.id ?? null);
        if (event.type === "tear" && tearSoundEnabledRef.current) playTearPop();
      }
    },
    [focusTile, playTearPop, requestKeepArrange, syncDiscoveryBoard],
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
      snapToGrid,
      arrangeMode,
      keepArranged,
      highlightedTileIds: settingsRef.current.highlightedTileIds,
    };
    if (!keepArranged) keepArrangePendingRef.current.clear();
    const world = worldRef.current;
    if (world) {
      world.setSoftness(softness / 100);
      world.setReducedMotion(reduced);
      world.setMode(mode);
      world.setVisualStyle(visualStyle);
      world.setTileRepulsion(tileRepulsion);
      world.setSnapToGrid(snapToGrid);
    }
  }, [
    softness,
    reduced,
    mode,
    visualStyle,
    tileRepulsion,
    snapToGrid,
    arrangeMode,
    keepArranged,
  ]);

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
    const pendingKeepArranges = keepArrangePendingRef.current;
    manifestRef.current = null;

    const draw = () => {
      const world = worldRef.current;
      if (!world) return;
      drawLayers(
        ctx,
        world.layers(),
        ratioRef.current,
        settingsRef.current.visualStyle,
        settingsRef.current.highlightedTileIds,
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
        dragging: world.isManipulating,
        animatingTiles: world.isAnimatingTiles,
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
          if (
            disposed ||
            (world !== playgroundWorldRef.current &&
              world !== discoveryWorldRef.current)
          )
            return;
          registerAssetsEverywhere(assets);
          if (worldRef.current === world) publish();
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
      if (event.button !== 0 || !worldRef.current || scriptSwitchingRef.current)
        return;
      if (
        activeTabRef.current === "discovery" &&
        discoveryRunRef.current?.phase !== "running"
      )
        return;
      unlockAudio();
      const point = coordinates(event);
      const world = worldRef.current;
      if (!world.pointerDown(point, event.pointerId)) return;
      const target = world.pointerTarget(event.pointerId);
      if (target) {
        focusTile(target.character, target.id);
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
      applyKeepArrange(world);
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
          applyKeepArrange(world);
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
      applyKeepArrange(world);
      canvas.style.cursor = world.pointerIds.length ? "grabbing" : "grab";
      publish();
      draw();
    };
    const onKey = (event: KeyboardEvent) => {
      const world = worldRef.current;
      if (!world || scriptSwitchingRef.current) return;
      if (
        activeTabRef.current === "discovery" &&
        (discoveryRunRef.current?.phase !== "running" ||
          event.key.toLowerCase() === "r")
      )
        return;
      if (event.key === "Escape") {
        cancel();
        return;
      }
      if (event.target !== canvas) return;
      if (event.key.toLowerCase() === "r") {
        world.reset();
        const focused = world
          .snapshot()
          .characters.find((object) => object.char === world.selectedCharacter);
        focusTile(world.selectedCharacter, focused?.id ?? null);
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
        worldRef.current
          ? {
              ...worldRef.current.snapshot(),
              playgroundTab: activeTabRef.current,
              discoveryRun: discoveryRunRef.current,
              discoveryScore: discoveryRunRef.current
                ? discoveryScore(discoveryRunRef.current)
                : 0,
              focusedTileId: focusedTileIdRef.current,
              highlightedTileIds: [...settingsRef.current.highlightedTileIds],
            }
          : {
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
      if (activeTabRef.current === "discovery") advanceRunClock(ms);
      handleWorldEvents(world);
      applyKeepArrange(world);
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
          applyKeepArrange(world);
          requestSceneAssets();
          if (activeTabRef.current === "discovery")
            advanceRunClock(STEP * 1000);
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
        registerAssetsEverywhere(assets);
        const resize = () => {
          cancel();
          const rect = canvas.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const ratio = Math.min(devicePixelRatio || 1, 2);
          ratioRef.current = ratio;
          canvas.width = Math.round(rect.width * ratio);
          canvas.height = Math.round(rect.height * ratio);
          if (playgroundWorldRef.current)
            playgroundWorldRef.current.resize(rect.width, rect.height);
          else {
            playgroundWorldRef.current = new PlaygroundWorld(
              rect.width,
              rect.height,
              cloneAssets(assetsRef.current ?? assets),
            );
          }
          if (discoveryWorldRef.current)
            discoveryWorldRef.current.resize(rect.width, rect.height);
          worldRef.current =
            activeTabRef.current === "discovery" && discoveryWorldRef.current
              ? discoveryWorldRef.current
              : playgroundWorldRef.current;
          const world = worldRef.current;
          if (!world) return;
          world.setSoftness(settingsRef.current.softness / 100);
          world.setReducedMotion(settingsRef.current.reduced);
          world.setMode(settingsRef.current.mode);
          world.setVisualStyle(settingsRef.current.visualStyle);
          world.setTileRepulsion(settingsRef.current.tileRepulsion);
          world.setSnapToGrid(settingsRef.current.snapToGrid);
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
      for (const timer of tileSoundTimersRef.current)
        window.clearTimeout(timer);
      tileSoundTimersRef.current = [];
      pendingKeepArranges.clear();
      cancel();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(preferenceFrame);
      observer?.disconnect();
      worldRef.current = null;
      playgroundWorldRef.current = null;
      discoveryWorldRef.current = null;
      assetsRef.current = null;
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
  }, [
    attempt,
    applyKeepArrange,
    advanceRunClock,
    focusTile,
    handleWorldEvents,
    registerAssetsEverywhere,
    unlockAudio,
  ]);

  const updateWorldControls = (world: PlaygroundWorld, discovery: boolean) => {
    world.setSoftness(softness / 100);
    world.setReducedMotion(reduced);
    world.setMode(discovery ? "weighted" : mode);
    world.setVisualStyle(visualStyle);
    world.setTileRepulsion(tileRepulsion);
    world.setSnapToGrid(discovery || snapToGrid);
  };

  const activateTab = (tab: PlaygroundTab) => {
    const canvas = canvasRef.current;
    const baseAssets = assetsRef.current;
    if (!ready || !canvas || !baseAssets) return;
    const previousWorld = worldRef.current;
    for (const pointerId of previousWorld?.pointerIds ?? [])
      if (canvas.hasPointerCapture(pointerId))
        canvas.releasePointerCapture(pointerId);
    previousWorld?.cancelAll();
    pointerStartsRef.current.clear();
    lastTapRef.current = null;
    const rect = canvas.getBoundingClientRect();
    if (tab === "discovery") {
      if (!discoveryWorldRef.current) {
        const world = new PlaygroundWorld(
          rect.width,
          rect.height,
          cloneAssets(baseAssets),
        );
        world.setCellBoard(Math.sqrt(discoveryCapacity) as 3 | 4 | 5 | 6);
        world.startCellBoard("想");
        discoveryWorldRef.current = world;
      } else if (!discoveryRunRef.current) {
        discoveryWorldRef.current.setCellBoard(
          Math.sqrt(discoveryCapacity) as 3 | 4 | 5 | 6,
        );
        discoveryWorldRef.current.startCellBoard("想");
      }
      worldRef.current = discoveryWorldRef.current;
      updateWorldControls(worldRef.current, true);
    } else {
      worldRef.current = playgroundWorldRef.current;
      if (!worldRef.current) return;
      updateWorldControls(worldRef.current, false);
    }
    activeTabRef.current = tab;
    setGameTab(tab);
    const world = worldRef.current;
    const focused = world?.snapshot().characters[0];
    if (focused) focusTile(focused.char, focused.id);
    if (world)
      setStatus({
        phase: world.phase,
        message: world.message,
        character: world.selectedCharacter,
        boardPreset: world.boardPreset,
        tileCount: world.tileCount,
      });
  };

  const startDiscovery = async () => {
    const canvas = canvasRef.current;
    const manifest = manifestRef.current;
    const assets = assetsRef.current;
    if (!canvas || !manifest || !assets) return;
    setDiscoveryStarting(true);
    setDiscoveryError("");
    runGenerationRef.current++;
    try {
      let drawSet =
        discoveryCollection === "playground"
          ? manifest.sampleCharacters.map(
              (character) => writingMapRef.current[character] ?? character,
            )
          : null;
      if (!drawSet) {
        const catalog = hskCharacters ?? (await loadPlaygroundHsk1());
        setHskCharacters(catalog);
        const variant =
          discoveryCollection === "hsk1-traditional"
            ? "traditional"
            : "simplified";
        drawSet = [...catalog.sets[variant].characters];
      }
      drawSet = drawSet.map(
        (character) => writingMapRef.current[character] ?? character,
      );
      drawSet = [...new Set(drawSet)].filter(
        (character) => Array.from(character).length === 1,
      );
      const runConfig = createDiscoveryRun(
        discoveryCollection,
        discoveryCapacity,
        drawSet,
      );
      let initialCharacter: string | null = null;
      let initialAssets: PlaygroundAssets | null = null;
      const rect = canvas.getBoundingClientRect();
      const candidates = [...drawSet];
      for (let index = candidates.length - 1; index > 0; index--) {
        const swapWith = Math.floor(Math.random() * (index + 1));
        [candidates[index], candidates[swapWith]] = [
          candidates[swapWith],
          candidates[index],
        ];
      }
      for (const character of candidates.slice(0, 40)) {
        try {
          initialAssets = await loadPlaygroundAssets([character], manifest);
          initialCharacter = character;
          break;
        } catch {
          continue;
        }
      }
      if (!initialCharacter || !initialAssets)
        throw new Error("No drawable character could be loaded from this set.");
      registerAssetsEverywhere(initialAssets);
      const world = new PlaygroundWorld(
        rect.width,
        rect.height,
        cloneAssets(assetsRef.current ?? assets),
      );
      world.setCellBoard(Math.sqrt(discoveryCapacity) as 3 | 4 | 5 | 6);
      world.setSoftness(softness / 100);
      world.setReducedMotion(reduced);
      world.setMode("weighted");
      world.setVisualStyle(visualStyle);
      world.setTileRepulsion(tileRepulsion);
      world.setSnapToGrid(true);
      world.startCellBoard(initialCharacter);
      discoveryWorldRef.current = world;
      worldRef.current = world;
      requestKeepArrange(world);
      activeTabRef.current = "discovery";
      setGameTab("discovery");
      displayedArrivalSecondRef.current = 10;
      const started = startDiscoveryRun(runConfig);
      publishDiscoveryRun(started);
      focusTile(initialCharacter, world.snapshot().characters[0]?.id ?? null);
      setStatus({
        phase: "whole",
        message: "The run is on. A new character arrives every 10 seconds.",
        character: initialCharacter,
        boardPreset: world.boardPreset,
        tileCount: world.tileCount,
        animatingTiles: world.isAnimatingTiles,
      });
    } catch (reason) {
      setDiscoveryError(
        reason instanceof Error
          ? reason.message
          : "The selected character collection could not be loaded.",
      );
    } finally {
      setDiscoveryStarting(false);
    }
  };

  const selectCharacter = async (char: string) => {
    const character = writingMapRef.current[char] ?? char;
    const world = worldRef.current;
    const manifest = manifestRef.current;
    if (!world || !manifest) return;
    setSelectionBusy(true);
    setSelectionError("");
    try {
      const assets = await loadPlaygroundAssets([character], manifest);
      if (worldRef.current !== world) return;
      world.registerAssets(assets);
      world.reset(character);
    } catch {
      setSelectionError(
        `No usable drawing data was found for ${character}. Try another dictionary character.`,
      );
      setSelectionBusy(false);
      return;
    }
    setSelectionBusy(false);
    const focused = world.snapshot().characters[0];
    focusTile(character, focused?.id ?? null);
    setStatus({
      phase: world.phase,
      message: world.message,
      character,
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
        settingsRef.current.highlightedTileIds,
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
    const enteredCharacter = value.trim();
    const character =
      writingMapRef.current[enteredCharacter] ?? enteredCharacter;
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
      if (result === "added") {
        requestKeepArrange(world);
        const added = world.snapshot().characters.at(-1);
        focusTile(character, added?.id ?? null);
      }
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
          settingsRef.current.highlightedTileIds,
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
    const focused = world.snapshot().characters[0];
    focusTile("想", focused?.id ?? null);
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
    const focused = world
      .snapshot()
      .characters.find((object) => object.char === world.selectedCharacter);
    focusTile(world.selectedCharacter, focused?.id ?? null);
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
  const arrangeTiles = () => {
    const world = worldRef.current;
    if (!world || !world.arrangeTiles(arrangeMode)) return;
    keepArrangePendingRef.current.delete(world);
    setStatus((current) => ({
      ...current,
      dragging: world.isManipulating,
      animatingTiles: world.isAnimatingTiles,
    }));
  };
  const blastTiles = () => {
    const world = worldRef.current;
    if (!world || !world.blastTiles()) return;
    keepArrangePendingRef.current.delete(world);
    setStatus((current) => ({
      ...current,
      dragging: world.isManipulating,
      animatingTiles: world.isAnimatingTiles,
    }));
  };
  const shuffleTiles = () => {
    const world = worldRef.current;
    if (!world) return;
    unlockAudio();
    if (!world.shuffleTiles()) return;
    keepArrangePendingRef.current.delete(world);
    playShuffleClacks(world.tileCount);
    setStatus((current) => ({
      ...current,
      dragging: world.isManipulating,
      animatingTiles: world.isAnimatingTiles,
    }));
  };
  const toggleTileHints = () => {
    if (hintsVisible) {
      settingsRef.current.highlightedTileIds.clear();
      setHintedTileIds([]);
      setHintsVisible(false);
      return;
    }
    const world = worldRef.current;
    if (!world || focusedTileId === null) return;
    const compatible = world.compatibleTileIds(focusedTileId);
    settingsRef.current.highlightedTileIds = new Set(compatible);
    setHintedTileIds(compatible);
    setHintsVisible(true);
  };
  const tileActionsDisabled =
    !ready ||
    selectionBusy ||
    scriptBusy ||
    !!status.dragging ||
    !!status.animatingTiles;
  const discoveryActionsDisabled =
    tileActionsDisabled || discoveryRun?.phase !== "running";
  const boardDescription =
    status.boardPreset === "starters"
      ? t("{count} starter characters", { count: status.tileCount })
      : status.boardPreset === "custom"
        ? t("{count} custom characters", { count: status.tileCount })
        : status.character;
  const surfaceName = t(
    visualStyle === "flat"
      ? "Flat"
      : visualStyle === "raised"
        ? "Raised"
        : visualStyle === "draped"
          ? "Draped"
          : "Silk",
  );
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
        <span className={styles.edition}>
          {t("THE PLAYGROUND / PHYSICS LAB")}
        </span>
        <Link href="/" className={styles.back}>
          {t("Back to the game ↗")}
        </Link>
        <LanguagePicker />
        <WritingSystemPicker />
      </header>
      <nav
        className={styles.gameTabs}
        role="tablist"
        aria-label={t("Playground games")}
      >
        <button
          id="playground-tab"
          type="button"
          role="tab"
          aria-selected={gameTab === "playground"}
          aria-controls="playground-game-panel"
          disabled={!ready}
          onClick={() => activateTab("playground")}
        >
          {t("Playground")}
        </button>
        <button
          id="discovery-tab"
          type="button"
          role="tab"
          aria-selected={gameTab === "discovery"}
          aria-controls="playground-game-panel"
          disabled={!ready}
          onClick={() => activateTab("discovery")}
        >
          {t("Discovery Run")}
        </button>
      </nav>
      <div className={styles.workspace}>
        <section
          className={styles.boardColumn}
          aria-label={t("Character gameboard")}
        >
          <section className={styles.intro}>
            <h1>
              {gameTab === "playground"
                ? t("Pull it apart. Bring it back together.")
                : t("Discovery Run")}
            </h1>
          </section>

          <div className={styles.stage} ref={stageRef}>
            {gameTab === "playground" ? (
              <PlaygroundBoard material={boardMaterial} />
            ) : (
              <DiscoveryBoard
                cells={Math.sqrt(discoveryCapacity) as 3 | 4 | 5 | 6}
              />
            )}
            <canvas
              ref={canvasRef}
              tabIndex={0}
              role="application"
              aria-label={
                gameTab === "playground"
                  ? t(
                      "Physical {board} playground in {style} surface style. Drag a mapped ink component while its source tile and remaining strokes stay in place. As soon as the component clears its source tile, it becomes a new tile that follows the held strokes until release, even if other tiles are nearby. Drag ink on a character without a supported decomposition to move the tile and ink together. Drag a blank tile face to move the whole character. Overlap compatible tile faces, or hold a detachable piece's ink over the compatible tile, to recombine.",
                      { board: boardDescription, style: surfaceName },
                    )
                  : t("Discovery Run game board")
              }
              aria-describedby="playground-keys"
            />
            {!ready && (
              <div className={styles.loading} role="status">
                {error ? (
                  <>
                    <span>{t("The character outlines couldn’t load.")}</span>
                    <button
                      onClick={() => {
                        setError(false);
                        setAttempt((value) => value + 1);
                      }}
                    >
                      {t("Try again")}
                    </button>
                  </>
                ) : (
                  t("The characters are taking shape…")
                )}
              </div>
            )}
            {gameTab === "playground" ? (
              <>
                <span className={styles.characterNote} aria-live="polite">
                  <strong>
                    {status.boardPreset !== "single"
                      ? t("{count} tiles", { count: status.tileCount })
                      : status.character}
                  </strong>{" "}
                  <i>{t(status.phase)}</i>
                </span>
                <span className={styles.stageNote} aria-hidden="true">
                  {t("A little give. A little gravity.")}
                </span>
              </>
            ) : (
              <div className={styles.discoveryHud} aria-live="polite">
                <span>
                  <small>{t("SCORE")}</small>
                  <strong>
                    {discoveryRun ? discoveryScore(discoveryRun) : 0}
                  </strong>
                </span>
                <span>
                  <small>{t("TILES")}</small>
                  <strong>
                    {status.tileCount}/{discoveryCapacity}
                  </strong>
                </span>
                <span>
                  <small>{t("DISCOVERED")}</small>
                  <strong>{discoveryRun?.discoveries.length ?? 0}</strong>
                </span>
                <span>
                  <small>{t("SURVIVED")}</small>
                  <strong>
                    {discoveryRun
                      ? `${Math.floor(discoveryRun.survivedMs / 60000)}:${String(
                          Math.floor(discoveryRun.survivedMs / 1000) % 60,
                        ).padStart(2, "0")}`
                      : "0:00"}
                  </strong>
                </span>
              </div>
            )}
            {gameTab === "discovery" &&
              (!discoveryRun || discoveryRun.phase === "setup") && (
                <div className={styles.discoveryPrompt}>
                  {t("Choose a collection and board size, then start.")}
                </div>
              )}
            {gameTab === "discovery" && discoveryRun?.phase === "running" && (
              <div className={styles.nextArrival} aria-live="polite">
                {t("Next character in {seconds}s", {
                  seconds: Math.ceil(
                    (discoveryRun.intervalMs - discoveryRun.elapsedMs) / 1000,
                  ),
                })}
              </div>
            )}
            {gameTab === "discovery" && discoveryRun?.phase === "over" && (
              <div className={styles.discoveryOverlay} role="status">
                <div>
                  <span className={styles.panelLabel}>{t("RUN COMPLETE")}</span>
                  <strong>{t("The board is full.")}</strong>
                  <p>
                    {t("Score")}: {discoveryScore(discoveryRun)} ·{" "}
                    {t("{count} new characters", {
                      count: discoveryRun.discoveries.length,
                    })}
                  </p>
                  <button type="button" onClick={() => void startDiscovery()}>
                    {t("Run again")}
                  </button>
                </div>
              </div>
            )}
          </div>
          {gameTab === "playground" && (
            <div className={styles.boardMaterialPicker}>
              <label htmlFor="playground-board-material">
                {t("Game board")}
              </label>
              <select
                id="playground-board-material"
                value={boardMaterial}
                onChange={(event) =>
                  setBoardMaterial(event.target.value as BoardMaterial)
                }
              >
                <option value="bamboo">{t("Bamboo table")}</option>
                <option value="slate">{t("Single slate slab")}</option>
                <option value="go19">
                  {t("Traditional Go board · 19×19")}
                </option>
                <option value="go9">{t("Compact Go board · 9×9")}</option>
                <option value="rice">{t("Rice-paper scroll")}</option>
              </select>
            </div>
          )}
          <p className={styles.liveMessage} role="status" aria-live="polite">
            {translateRuntimeText(language, status.message)}
          </p>
        </section>

        {gameTab === "playground" ? (
          <aside
            id="playground-game-panel"
            className={styles.sidebar}
            aria-label={t("Playground controls")}
            role="tabpanel"
            aria-labelledby="playground-tab"
          >
            <section className={styles.instructions}>
              <p className={styles.panelLabel}>{t("HOW TO PLAY")}</p>
              <h2>{t("Pull, place, recombine")}</h2>
              <p>
                {t(
                  "Start with five characters. Pull a mapped stroke group away. The rest stays in place; as soon as the component clears its source tile, both pieces become tiles and the pulled tile follows your finger until release. Other tiles do not need to be moved out of the way. On characters without a supported decomposition, dragging the strokes moves the tile and ink together. Overlap compatible tiles to recombine them, or hold a detachable piece's ink over the compatible tile to guide it into place.",
                )}
              </p>
              <p>
                {t(
                  "Double-tap a character or one of its strokes to unfold one supported step.",
                )}
              </p>
              <p>
                {t(
                  "Drag a blank tile face to move the whole character. Fixed keeps it centered; Weighted gives it more movement.",
                )}
              </p>
              <p>
                {t(
                  "Add any drawable dictionary character to keep building the board, or explore it alone to replace the current scene.",
                )}
              </p>
            </section>

            <section
              className={styles.focusCard}
              aria-label={t("Character details for {char}", {
                char: focusedCharacter,
              })}
              aria-live="polite"
            >
              <span className={styles.focusCharacter} aria-hidden="true">
                {focusedCharacter}
              </span>
              <div className={styles.focusDetails}>
                <span className={styles.focusLabel}>{t("IN FOCUS")}</span>
                <p className={styles.focusPinyin}>
                  {focusInfo?.pinyin.join(" · ") ||
                    (dictionary
                      ? t("Pronunciation unavailable")
                      : t("Loading pronunciation…"))}
                </p>
                <p className={styles.focusDefinition}>
                  {focusInfo?.definition ||
                    (dictionary
                      ? t("Definition unavailable")
                      : t("Loading definition…"))}
                </p>
              </div>
            </section>

            <div className={styles.sidebarScroll}>
              <section
                className={styles.boardPicker}
                aria-label={t("Starting board")}
              >
                <span className={styles.controlLabel}>
                  {t("Starting board")}
                </span>
                <button
                  className={styles.starterButton}
                  type="button"
                  disabled={!ready}
                  aria-pressed={status.boardPreset === "starters"}
                  onClick={selectStarters}
                >
                  {t("Five starters")}
                </button>
              </section>

              <section
                className={styles.samples}
                aria-label={t("Try a character")}
              >
                <span className={styles.controlLabel}>
                  {t("Try a character")}
                </span>
                <div className={styles.sampleButtons}>
                  {samples.map((char) => (
                    <button
                      key={char}
                      type="button"
                      disabled={!ready || selectionBusy || scriptBusy}
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
                    {t("Any dictionary character")}
                  </label>
                  <div>
                    <input
                      id="playground-character"
                      value={characterInput}
                      maxLength={2}
                      autoComplete="off"
                      disabled={!ready || selectionBusy || scriptBusy}
                      onChange={(event) =>
                        setCharacterInput(event.target.value)
                      }
                      aria-describedby="playground-character-help"
                    />
                    <button
                      type="submit"
                      disabled={!ready || selectionBusy || scriptBusy}
                    >
                      {selectionBusy || scriptBusy
                        ? t("Loading…")
                        : t("Explore")}
                    </button>
                    <button
                      type="button"
                      aria-label={t("Add to board")}
                      disabled={!ready || selectionBusy || scriptBusy}
                      onClick={() =>
                        void addCharacterToBoard(characterInput, true)
                      }
                    >
                      {t("Add")}
                    </button>
                  </div>
                  <p
                    id="playground-character-help"
                    role="status"
                    aria-live="polite"
                  >
                    {selectionError
                      ? translateRuntimeText(language, selectionError)
                      : glyphCount === null
                        ? t(
                            "Thousands of glyph outlines load only when needed.",
                          )
                        : t("{count} glyph outlines load only when needed.", {
                            count: glyphCount.toLocaleString(),
                          })}
                  </p>
                </form>
              </section>

              <section
                className={styles.hskPicker}
                aria-label={t("HSK 1 characters")}
              >
                <button
                  className={styles.hskToggle}
                  type="button"
                  aria-expanded={hskOpen}
                  aria-controls="playground-hsk1-list"
                  onClick={() => setHskOpen((open) => !open)}
                >
                  <span>{t("HSK 1 character set")}</span>
                  <span aria-hidden="true">{hskOpen ? "−" : "+"}</span>
                </button>
                {hskOpen && (
                  <div className={styles.hskContents} id="playground-hsk1-list">
                    <div
                      className={styles.hskVariants}
                      role="group"
                      aria-label={t("Writing system")}
                    >
                      <button
                        type="button"
                        aria-pressed={hskVariant === "simplified"}
                        onClick={() => setHskVariant("simplified")}
                      >
                        {t("Simplified")}
                      </button>
                      <button
                        type="button"
                        aria-pressed={hskVariant === "traditional"}
                        onClick={() => setHskVariant("traditional")}
                      >
                        {t("Traditional")}
                      </button>
                    </div>
                    {hskLoading ? (
                      <p className={styles.hskNote} role="status">
                        {t("Loading HSK 1…")}
                      </p>
                    ) : hskError ? (
                      <div className={styles.hskError} role="status">
                        <span>{t(hskError)}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setHskAttempt((attempt) => attempt + 1)
                          }
                        >
                          {t("Retry")}
                        </button>
                      </div>
                    ) : hskCharacters ? (
                      <>
                        <p className={styles.hskNote} role="status">
                          {hskCharacters.sets[hskVariant].characters.length}{" "}
                          {t("drawable characters")}
                          {hskCharacters.sets[hskVariant].unavailableCharacters
                            .length > 0 &&
                            " · " +
                              hskCharacters.sets[hskVariant]
                                .unavailableCharacters.length +
                              ` ${t("without stroke outlines")}`}
                        </p>
                        <div
                          key={hskVariant}
                          className={styles.hskCharacters}
                          role="group"
                          aria-label={
                            (hskVariant === "simplified"
                              ? t("Simplified")
                              : t("Traditional")) + ` ${t("HSK 1 characters")}`
                          }
                        >
                          {hskCharacters.sets[hskVariant].characters.map(
                            (char) => (
                              <button
                                key={char}
                                type="button"
                                aria-label={t("Add {char} from HSK 1", {
                                  char,
                                })}
                                disabled={!ready || selectionBusy || scriptBusy}
                                onClick={() => void addCharacterToBoard(char)}
                              >
                                {char}
                              </button>
                            ),
                          )}
                        </div>
                        <p className={styles.hskNote}>
                          {t(
                            "Click a character to add it to the current board. HSK 2.0 list.",
                          )}{" "}
                          <a
                            href={hskCharacters.source}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("Source")}
                          </a>{" "}
                          ·{" "}
                          <a href={publicAssetUrl(hskCharacters.license)}>
                            {t("MIT license")}
                          </a>
                        </p>
                      </>
                    ) : null}
                  </div>
                )}
              </section>

              <fieldset className={styles.modePicker}>
                <legend>{t("Character weight")}</legend>
                <label>
                  <input
                    type="radio"
                    name="physics-mode"
                    value="fixed"
                    checked={mode === "fixed"}
                    onChange={() => setMode("fixed")}
                  />
                  {t("Fixed")} <span>{t("stays centered")}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="physics-mode"
                    value="weighted"
                    checked={mode === "weighted"}
                    onChange={() => setMode("weighted")}
                  />
                  {t("Weighted")} <span>{t("moves with resistance")}</span>
                </label>
              </fieldset>

              <fieldset className={styles.modePicker}>
                <legend>{t("Tile interaction")}</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={tileRepulsion}
                    onChange={(event) => setTileRepulsion(event.target.checked)}
                  />
                  {t("Tile repulsion")}{" "}
                  <span>{t("loose faces nudge apart")}</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={tearSoundEnabled}
                    onChange={(event) => {
                      tearSoundEnabledRef.current = event.target.checked;
                      setTearSoundEnabled(event.target.checked);
                    }}
                  />
                  {t("Pop sound when a component tears free")}
                </label>
              </fieldset>

              <section
                className={styles.tileTools}
                aria-label={t("Tile tools")}
              >
                <label className={styles.controlLabel} htmlFor="arrange-mode">
                  {t("Arrange mode")}
                </label>
                <select
                  id="arrange-mode"
                  aria-label={t("Arrange mode")}
                  value={arrangeMode}
                  disabled={tileActionsDisabled}
                  onChange={(event) =>
                    setArrangeMode(event.target.value as ArrangeMode)
                  }
                >
                  <option value="one-by-one">{t("One at a time")}</option>
                  <option value="all-at-once">{t("All at once")}</option>
                  <option value="by-component">
                    {t("Group by shared components")}
                  </option>
                </select>
                <button
                  type="button"
                  disabled={tileActionsDisabled}
                  onClick={blastTiles}
                >
                  {t("Blast!")}
                </button>
                <button
                  type="button"
                  disabled={tileActionsDisabled || status.tileCount < 2}
                  onClick={shuffleTiles}
                >
                  {t("Shuffle")}
                </button>
                <button
                  type="button"
                  disabled={tileActionsDisabled}
                  onClick={arrangeTiles}
                >
                  {t("Arrange tiles")}
                </button>
                <label className={styles.tileToolCheck}>
                  <input
                    type="checkbox"
                    checked={keepArranged}
                    disabled={!ready || selectionBusy || scriptBusy}
                    onChange={(event) => setKeepArranged(event.target.checked)}
                  />
                  {t("Keep arranged")}
                </label>
                <p className={styles.tileToolStatus}>
                  {t("Re-run this arrange mode whenever new tiles are added.")}
                </p>
                <label className={styles.tileToolCheck}>
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    disabled={!ready || selectionBusy || scriptBusy}
                    onChange={(event) => setSnapToGrid(event.target.checked)}
                  />
                  {t("Snap to grid when released")}
                </label>
                <button
                  type="button"
                  aria-pressed={hintsVisible}
                  disabled={tileActionsDisabled || focusedTileId === null}
                  onClick={toggleTileHints}
                >
                  {hintsVisible
                    ? t("Hide tile hints")
                    : t("Highlight compatible tiles")}
                </button>
                {hintsVisible && (
                  <p
                    className={styles.tileToolStatus}
                    role="status"
                    aria-live="polite"
                  >
                    {hintedTileIds.length
                      ? t("{count} compatible tiles highlighted", {
                          count: hintedTileIds.length,
                        })
                      : t("No compatible loose tiles for this character.")}
                  </p>
                )}
              </section>

              <fieldset className={styles.stylePicker}>
                <legend>{t("Surface style")}</legend>
                <label>
                  <input
                    type="radio"
                    name="visual-style"
                    value="flat"
                    checked={visualStyle === "flat"}
                    onChange={() => setVisualStyle("flat")}
                  />
                  {t("Flat")} <span>{t("ink only")}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="visual-style"
                    value="raised"
                    checked={visualStyle === "raised"}
                    onChange={() => setVisualStyle("raised")}
                  />
                  {t("Raised")} <span>{t("embossed")}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="visual-style"
                    value="draped"
                    checked={visualStyle === "draped"}
                    onChange={() => setVisualStyle("draped")}
                  />
                  {t("Draped")} <span>{t("over the edge")}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="visual-style"
                    value="silk"
                    checked={visualStyle === "silk"}
                    onChange={() => setVisualStyle("silk")}
                  />
                  {t("Silk")} <span>{t("down to the table")}</span>
                </label>
              </fieldset>

              <section
                className={styles.controls}
                aria-label={t("Physics controls")}
              >
                <label className={styles.softness}>
                  {t("Softness")}
                  <input
                    aria-label={t("Softness")}
                    type="range"
                    min="0"
                    max="100"
                    value={softness}
                    disabled={reduced}
                    onChange={(event) =>
                      setSoftness(Number(event.target.value))
                    }
                  />
                  <span>
                    {reduced
                      ? t("Still")
                      : softness < 34
                        ? t("Firm")
                        : softness > 70
                          ? t("Floppy")
                          : t("Supple")}
                  </span>
                </label>
                <div className={styles.actions}>
                  <button disabled={!ready} onClick={nudge}>
                    {t("Give it a nudge")} <span aria-hidden="true">↝</span>
                  </button>
                  <button disabled={!ready} onClick={reset}>
                    {t("Reset")} <span aria-hidden="true">↺</span>
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
                  {t("Reduce motion")}
                </label>
                <p id="playground-keys">
                  {t(
                    "Keyboard: arrows to nudge · R to reset · F for fullscreen · Escape to release.",
                  )}
                </p>
              </footer>
            </div>
          </aside>
        ) : (
          <aside
            id="playground-game-panel"
            className={styles.sidebar}
            aria-label={t("Discovery Run controls")}
            role="tabpanel"
            aria-labelledby="discovery-tab"
          >
            <section className={styles.instructions}>
              <p className={styles.panelLabel}>{t("SURVIVAL GAME")}</p>
              <h2>{t("Make room for discovery")}</h2>
              <p>
                {t(
                  "A new character arrives every 10 seconds. Keep the board below its tile limit by tearing characters apart and recombining their pieces. The run ends when the board fills.",
                )}
              </p>
              <p>
                {t(
                  "Earn one point for each character delivered and one for every distinct character outside your collection that appears, even if you later recombine it.",
                )}
              </p>
            </section>
            {discoveryRun?.phase === "running" ? (
              <div className={styles.discoveryRunDetails}>
                <div className={styles.discoveryScoreCard}>
                  <span>{t("CURRENT SCORE")}</span>
                  <strong>{discoveryScore(discoveryRun)}</strong>
                  <small>
                    {discoveryRun.delivered} {t("delivered")} +{" "}
                    {discoveryRun.discoveries.length} {t("discoveries")}
                  </small>
                </div>
                <p className={styles.runMeta}>
                  {t("Board capacity")}: {discoveryRun.capacity} ·{" "}
                  {t("New tile in {seconds}s", {
                    seconds: Math.ceil(
                      (discoveryRun.intervalMs - discoveryRun.elapsedMs) / 1000,
                    ),
                  })}
                </p>
                <div className={styles.discoveryCharacterList}>
                  <span className={styles.controlLabel}>
                    {t("DISCOVERED CHARACTERS")}
                  </span>
                  {discoveryRun.discoveries.length ? (
                    <div aria-label={t("New characters discovered")}>
                      {discoveryRun.discoveries.map((character) => (
                        <span key={character}>{character}</span>
                      ))}
                    </div>
                  ) : (
                    <p>
                      {t(
                        "Pull apart a character to make your first discovery.",
                      )}
                    </p>
                  )}
                </div>
                <button
                  className={styles.secondaryAction}
                  type="button"
                  onClick={() => activateTab("playground")}
                >
                  {t("Pause and return to Playground")}
                </button>
              </div>
            ) : (
              <div className={styles.discoverySetup}>
                <label htmlFor="discovery-collection">
                  {t("Tile collection")}
                  <select
                    id="discovery-collection"
                    value={discoveryCollection}
                    disabled={discoveryStarting}
                    onChange={(event) =>
                      setDiscoveryCollection(
                        event.target.value as DiscoveryCollection,
                      )
                    }
                  >
                    <option value="playground">
                      {t("Playground collection")}
                    </option>
                    <option value="hsk1-simplified">
                      {t("HSK 1 Simplified")}
                    </option>
                    <option value="hsk1-traditional">
                      {t("HSK 1 Traditional")}
                    </option>
                  </select>
                </label>
                <label htmlFor="discovery-capacity">
                  {t("Board size")}
                  <select
                    id="discovery-capacity"
                    value={discoveryCapacity}
                    disabled={discoveryStarting}
                    onChange={(event) => {
                      const capacity = Number(
                        event.target.value,
                      ) as DiscoveryCapacity;
                      setDiscoveryCapacity(capacity);
                      const world = discoveryWorldRef.current;
                      if (world && !discoveryRunRef.current) {
                        world.setCellBoard(
                          Math.sqrt(capacity) as 3 | 4 | 5 | 6,
                        );
                        world.startCellBoard("想");
                        setStatus((current) => ({
                          ...current,
                          tileCount: world.tileCount,
                          boardPreset: world.boardPreset,
                        }));
                      }
                    }}
                  >
                    {discoveryCapacities.map((capacity) => (
                      <option key={capacity} value={capacity}>
                        {capacity}{" "}
                        {t("spaces · {grid}×{grid}", {
                          grid: Math.sqrt(capacity),
                        })}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  {t(
                    "Tiles are sized to fit the cells and snap into place when released.",
                  )}
                </p>
                <button
                  className={styles.primaryAction}
                  type="button"
                  disabled={!ready || discoveryStarting}
                  onClick={() => void startDiscovery()}
                >
                  {discoveryStarting
                    ? t("Preparing the board…")
                    : t("Start Discovery Run")}
                </button>
                {discoveryError && (
                  <p className={styles.discoveryError} role="status">
                    {translateRuntimeText(language, discoveryError)}
                  </p>
                )}
              </div>
            )}
            <section className={styles.tileTools} aria-label={t("Tile tools")}>
              <label
                className={styles.controlLabel}
                htmlFor="discovery-arrange-mode"
              >
                {t("Arrange mode")}
              </label>
              <select
                id="discovery-arrange-mode"
                aria-label={t("Arrange mode")}
                value={arrangeMode}
                disabled={!ready || selectionBusy || scriptBusy}
                onChange={(event) =>
                  setArrangeMode(event.target.value as ArrangeMode)
                }
              >
                <option value="one-by-one">{t("One at a time")}</option>
                <option value="all-at-once">{t("All at once")}</option>
                <option value="by-component">
                  {t("Group by shared components")}
                </option>
              </select>
              <button
                type="button"
                disabled={discoveryActionsDisabled}
                onClick={blastTiles}
              >
                {t("Blast!")}
              </button>
              <button
                type="button"
                disabled={discoveryActionsDisabled || status.tileCount < 2}
                onClick={shuffleTiles}
              >
                {t("Shuffle")}
              </button>
              <button
                type="button"
                disabled={discoveryActionsDisabled}
                onClick={arrangeTiles}
              >
                {t("Arrange tiles")}
              </button>
              <label className={styles.tileToolCheck}>
                <input
                  type="checkbox"
                  checked={keepArranged}
                  disabled={!ready || selectionBusy || scriptBusy}
                  onChange={(event) => setKeepArranged(event.target.checked)}
                />
                {t("Keep arranged")}
              </label>
              <p className={styles.tileToolStatus}>
                {t("Re-run this arrange mode whenever new tiles are added.")}
              </p>
            </section>
            <footer className={styles.footer}>
              <p id="playground-keys">
                {t(
                  "Switching to Playground pauses the arrival clock. Your run and score stay here when you return.",
                )}
              </p>
              <p>{t("Character strokes load as they are needed.")}</p>
            </footer>
          </aside>
        )}
      </div>
      <p className={styles.credit}>
        {t("Reviewed outlines and component matches: ")}{" "}
        <a
          href="https://github.com/skishore/makemeahanzi"
          target="_blank"
          rel="noreferrer"
        >
          Make Me a Hanzi
        </a>{" "}
        · © 1999 Arphic Technology · Freely redistributable under the{" "}
        <a href={publicAssetUrl("data/licenses/ARPHICPL.TXT")}>
          {t("Arphic Public License")}
        </a>
        , without warranty.
      </p>
    </main>
  );
}

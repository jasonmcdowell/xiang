export type DiscoveryCollection =
  "playground" | "hsk1-simplified" | "hsk1-traditional";
export type DiscoveryCapacity = 9 | 16 | 25 | 36;
export type DiscoveryPhase = "setup" | "running" | "over";

export type DiscoveryRun = {
  phase: DiscoveryPhase;
  collection: DiscoveryCollection;
  capacity: DiscoveryCapacity;
  drawCharacters: string[];
  intervalMs: number;
  elapsedMs: number;
  survivedMs: number;
  delivered: number;
  discoveries: string[];
};

export const DISCOVERY_INTERVAL_MS = 10_000;

export function createDiscoveryRun(
  collection: DiscoveryCollection,
  capacity: DiscoveryCapacity,
  drawCharacters: string[],
): DiscoveryRun {
  return {
    phase: "setup",
    collection,
    capacity,
    drawCharacters: [...new Set(drawCharacters)],
    intervalMs: DISCOVERY_INTERVAL_MS,
    elapsedMs: 0,
    survivedMs: 0,
    delivered: 0,
    discoveries: [],
  };
}

export function startDiscoveryRun(run: DiscoveryRun): DiscoveryRun {
  return {
    ...run,
    phase: "running",
    elapsedMs: 0,
    survivedMs: 0,
    delivered: 1,
    discoveries: [],
  };
}

export function drawCharacter(
  characters: string[],
  random: () => number = Math.random,
): string | null {
  if (!characters.length) return null;
  const index = Math.min(
    characters.length - 1,
    Math.floor(Math.max(0, random()) * characters.length),
  );
  return characters[index] ?? null;
}

export function advanceDiscoveryClock(
  run: DiscoveryRun,
  elapsedMs: number,
): { run: DiscoveryRun; arrivalsDue: number } {
  if (run.phase !== "running" || !Number.isFinite(elapsedMs) || elapsedMs <= 0)
    return { run, arrivalsDue: 0 };
  const total = run.elapsedMs + elapsedMs;
  const arrivalsDue = Math.floor(total / run.intervalMs);
  return {
    run: {
      ...run,
      elapsedMs: total % run.intervalMs,
      survivedMs: run.survivedMs + elapsedMs,
    },
    arrivalsDue,
  };
}

export function recordDiscoveryBoard(
  run: DiscoveryRun,
  characters: string[],
): DiscoveryRun {
  if (run.phase !== "running") return run;
  const drawSet = new Set(run.drawCharacters);
  const discoveries = new Set(run.discoveries);
  for (const character of characters)
    if (!drawSet.has(character)) discoveries.add(character);
  return { ...run, discoveries: [...discoveries].sort() };
}

export function recordDiscoveryArrival(run: DiscoveryRun): DiscoveryRun {
  if (run.phase !== "running") return run;
  return { ...run, delivered: run.delivered + 1 };
}

export function finishDiscoveryRun(
  run: DiscoveryRun,
  tileCount: number,
): DiscoveryRun {
  return run.phase === "running" && tileCount >= run.capacity
    ? { ...run, phase: "over" }
    : run;
}

export function discoveryScore(run: DiscoveryRun) {
  return run.delivered + run.discoveries.length;
}

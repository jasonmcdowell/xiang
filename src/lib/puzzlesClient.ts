import { publicAssetUrl } from "@/lib/publicAssetUrl";

export type PuzzleScramble = {
  phrase: string;
  shared: number;
  len: number;
  decomposableChars: number;
  nonDecomposableChars: number;
  expansionsUsed: number;
  bagSize: number;
};

export type PuzzleItem = {
  target: string;
  bag: string[];
  expansion: { depth2Expanded: string[] };
  scrambles: PuzzleScramble[];
};

export type PuzzlesData = {
  version: number;
  generatedAt: string;
  items: PuzzleItem[];
};

let cachedData: PuzzlesData | null = null;
let inflight: Promise<PuzzlesData> | null = null;

export async function loadPuzzles(): Promise<PuzzlesData> {
  if (cachedData) {
    return cachedData;
  }
  if (inflight) {
    return inflight;
  }

  inflight = fetch(publicAssetUrl("data/puzzles/chid_scrambles_v1.json"))
    .then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load chid_scrambles_v1.json");
      }
      return res.json() as Promise<PuzzlesData>;
    })
    .then((data) => {
      cachedData = data;
      return cachedData;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

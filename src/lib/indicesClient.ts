import { publicAssetUrl } from "@/lib/publicAssetUrl";

export type DecompMap = Record<string, string[]>;
export type ComposeMap = Record<string, string[]>;
export type FreqMap = Record<string, number>;
export type MetaMap = Record<
  string,
  {
    pinyin: string[];
    definition: string;
  }
>;

export type IndicesData = {
  decomp: DecompMap;
  compose: ComposeMap;
  freq: FreqMap;
  meta: MetaMap;
  characterMap?: Record<string, string>;
  recipePool?: string[];
};

export type WritingSystem = "simplified" | "traditional";
export type CharacterVariantMaps = Record<
  WritingSystem,
  Record<string, string>
>;

export function createWritingSystemIndices(
  source: IndicesData,
  characterMap: Record<string, string>,
  recipeCharacters: string[],
): IndicesData {
  const convert = (character: string) => characterMap[character] ?? character;
  const decomp: DecompMap = {};
  const orderedEntries = Object.entries(source.decomp).sort(([a], [b]) => {
    const aIsTarget = convert(a) === a;
    const bIsTarget = convert(b) === b;
    return Number(bIsTarget) - Number(aIsTarget) || a.localeCompare(b);
  });
  for (const [character, children] of orderedEntries) {
    const target = convert(character);
    if (!decomp[target]) {
      decomp[target] = children.map((child) => {
        const mapped = normalizeChar(convert(child));
        return mapped === target ? normalizeChar(child) : mapped;
      });
    }
  }

  const compose: ComposeMap = {};
  const freq: FreqMap = {};
  for (const [parent, children] of Object.entries(decomp)) {
    for (const child of children) freq[child] = (freq[child] ?? 0) + 1;
    if (children.length !== 2) continue;
    const [a, b] = children.map(normalizeChar);
    const pairs = new Set([`${a}|${b}`, `${b}|${a}`]);
    for (const pair of pairs) (compose[pair] ??= []).push(parent);
  }
  for (const parents of Object.values(compose)) parents.sort();

  const meta: MetaMap = {};
  const orderedMetadata = Object.entries(source.meta).sort(([a], [b]) => {
    const aIsTarget = convert(a) === a;
    const bIsTarget = convert(b) === b;
    return Number(bIsTarget) - Number(aIsTarget) || a.localeCompare(b);
  });
  for (const [character, entry] of orderedMetadata) {
    const target = convert(character);
    if (!meta[target]) meta[target] = entry;
  }

  return {
    decomp,
    compose,
    freq,
    meta,
    characterMap,
    recipePool: [...new Set(recipeCharacters.map(convert))].filter(
      (character) => decomp[character]?.length === 2,
    ),
  };
}

const VARIANT_MAP: Record<string, string> = {
  忄: "心",
  扌: "手",
  氵: "水",
  亻: "人",
  訁: "言",
  礻: "示",
};

let cachedData: IndicesData | null = null;
let inflight: Promise<IndicesData> | null = null;

export function normalizeChar(value: string): string {
  return VARIANT_MAP[value] ?? value;
}

export async function loadIndices(): Promise<IndicesData> {
  if (cachedData) {
    return cachedData;
  }
  if (inflight) {
    return inflight;
  }

  inflight = Promise.all([
    fetch(publicAssetUrl("data/decomp.json")).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load decomp.json");
      }
      return res.json() as Promise<DecompMap>;
    }),
    fetch(publicAssetUrl("data/compose_pairs.json")).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load compose_pairs.json");
      }
      return res.json() as Promise<ComposeMap>;
    }),
    fetch(publicAssetUrl("data/component_freq.json")).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load component_freq.json");
      }
      return res.json() as Promise<FreqMap>;
    }),
    fetch(publicAssetUrl("data/meta.json")).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load meta.json");
      }
      return res.json() as Promise<MetaMap>;
    }),
  ])
    .then(([decomp, compose, freq, meta]) => {
      cachedData = { decomp, compose, freq, meta };
      return cachedData;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

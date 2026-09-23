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
};

const VARIANT_MAP: Record<string, string> = {
  "忄": "心",
  "扌": "手",
  "氵": "水",
  "亻": "人",
  "訁": "言",
  "礻": "示",
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

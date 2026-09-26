import {
  createReadStream,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import OpenCC from "opencc-js";

const STARTERS = ["想", "相", "明", "休", "好"];
const SAMPLES = [...STARTERS, "林", "森"];
const DATA_DIRECTORY = "public/data/playground";
const GLYPH_DIRECTORY = `${DATA_DIRECTORY}/glyphs`;
const RECIPE_DIRECTORY = `${DATA_DIRECTORY}/recipes`;

const isHanCharacter = (value) =>
  typeof value === "string" && /^\p{Unified_Ideograph}$/u.test(value);
const assetName = (character) =>
  `${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}.json`;

async function readJsonLines(file, map, accept) {
  const source = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of source) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (accept(entry)) map.set(entry.character, entry);
  }
  return map;
}

const decompositions = JSON.parse(
  readFileSync("public/data/decomp.json", "utf8"),
);
const extensions = JSON.parse(
  readFileSync("data/decomposition_extensions.json", "utf8"),
);
const [dictionary, graphics] = await Promise.all([
  readJsonLines(
    "data/makemeahanzi/dictionary.txt",
    new Map(),
    (entry) => isHanCharacter(entry.character) && Array.isArray(entry.matches),
  ),
  readJsonLines(
    "data/makemeahanzi/graphics.txt",
    new Map(),
    (entry) =>
      isHanCharacter(entry.character) &&
      Array.isArray(entry.strokes) &&
      entry.strokes.length > 0 &&
      entry.strokes.every((stroke) => typeof stroke === "string"),
  ),
]);

const toSimplified = OpenCC.Converter({ from: "tw", to: "cn" });
const toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
const conversionCharacters = new Set([
  ...dictionary.keys(),
  ...graphics.keys(),
  ...Object.keys(decompositions),
  ...Object.values(decompositions).flat(),
]);
const characterVariants = { simplified: {}, traditional: {} };
const playgroundCharacterVariants = { simplified: {}, traditional: {} };
for (const character of conversionCharacters) {
  for (const [system, convert] of [
    ["simplified", toSimplified],
    ["traditional", toTraditional],
  ]) {
    const converted = convert(character);
    if (isHanCharacter(converted) && converted !== character) {
      characterVariants[system][character] = converted;
      if (graphics.has(character) && graphics.has(converted))
        playgroundCharacterVariants[system][character] = converted;
    }
  }
}

rmSync(GLYPH_DIRECTORY, { recursive: true, force: true });
rmSync(RECIPE_DIRECTORY, { recursive: true, force: true });
mkdirSync(GLYPH_DIRECTORY, { recursive: true });
mkdirSync(RECIPE_DIRECTORY, { recursive: true });

for (const [character, glyph] of graphics) {
  writeFileSync(
    `${GLYPH_DIRECTORY}/${assetName(character)}`,
    `${JSON.stringify({ character, strokes: glyph.strokes })}\n`,
  );
}

const recipeCharacters = [];
const compositionParents = new Map();
let exactBinaryCount = 0;
let reviewedGroupingCount = 0;
let ineligibleMappingCount = 0;

for (const [character, childrenFromIndex] of Object.entries(decompositions)) {
  const dictionaryEntry = dictionary.get(character);
  const glyph = graphics.get(character);
  if (!dictionaryEntry || !glyph) continue;

  const reviewed = extensions[character]?.playground;
  const children = reviewed?.children ?? childrenFromIndex;
  if (!Array.isArray(children) || children.length !== 2) continue;

  if (
    reviewed &&
    (!reviewed.reason ||
      !Array.isArray(reviewed.strokePathPrefixes) ||
      reviewed.strokePathPrefixes.length !== children.length)
  ) {
    throw new Error(`Incomplete reviewed stroke grouping for ${character}.`);
  }
  if (
    !Array.isArray(dictionaryEntry.matches) ||
    dictionaryEntry.matches.length !== glyph.strokes.length
  ) {
    ineligibleMappingCount += 1;
    continue;
  }

  const parts = children.map((child, childIndex) => {
    const strokeIndices = dictionaryEntry.matches
      .map((match, strokeIndex) => {
        if (reviewed) {
          const prefixes = reviewed.strokePathPrefixes[childIndex];
          return Array.isArray(prefixes) &&
            prefixes.some(
              (prefix) =>
                Array.isArray(prefix) &&
                prefix.length <= (match?.length ?? 0) &&
                prefix.every((index, pathIndex) => match[pathIndex] === index),
            )
            ? strokeIndex
            : -1;
        }
        return match?.length === 1 && match[0] === childIndex
          ? strokeIndex
          : -1;
      })
      .filter((strokeIndex) => strokeIndex >= 0);
    return { character: child, strokeIndices };
  });
  const assigned = parts.flatMap((part) => part.strokeIndices);
  const valid =
    parts.every(
      (part) =>
        isHanCharacter(part.character) &&
        graphics.has(part.character) &&
        part.strokeIndices.length > 0,
    ) &&
    assigned.length === glyph.strokes.length &&
    new Set(assigned).size === glyph.strokes.length &&
    assigned.every((index) => index >= 0 && index < glyph.strokes.length);
  if (!valid) {
    ineligibleMappingCount += 1;
    continue;
  }

  const recipe = {
    character,
    decomposition: dictionaryEntry.decomposition,
    parts,
    ...(reviewed ? { review: reviewed.reason } : {}),
  };
  writeFileSync(
    `${RECIPE_DIRECTORY}/${assetName(character)}`,
    `${JSON.stringify(recipe)}\n`,
  );
  recipeCharacters.push(character);
  if (reviewed) reviewedGroupingCount += 1;
  else exactBinaryCount += 1;

  const pairKey = [...children].sort().join("|");
  const parents = compositionParents.get(pairKey) ?? new Set();
  parents.add(character);
  compositionParents.set(pairKey, parents);
}

for (const character of STARTERS) {
  if (!graphics.has(character) || !recipeCharacters.includes(character))
    throw new Error(
      `The starting character ${character} is not physics-ready.`,
    );
}

const compositionIndex = Object.fromEntries(
  [...compositionParents.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, parents]) => [key, [...parents].sort()]),
);
const hsk1 = Object.fromEntries(
  ["simp", "trad"].map((variant) => {
    const sourceCharacters = [
      ...new Set(
        readFileSync(`public/data/charlists/hsk1_${variant}.txt`, "utf8")
          .split(/\s+/u)
          .filter(isHanCharacter),
      ),
    ];
    return [
      variant === "simp" ? "simplified" : "traditional",
      {
        total: sourceCharacters.length,
        characters: sourceCharacters.filter((character) =>
          graphics.has(character),
        ),
        unavailableCharacters: sourceCharacters.filter(
          (character) => !graphics.has(character),
        ),
      },
    ];
  }),
);
const manifest = {
  schemaVersion: 2,
  source: "https://github.com/skishore/makemeahanzi",
  license: "/data/licenses/ARPHICPL.TXT",
  copyright: "Copyright (C) 1999 Arphic Technology Co., Ltd.",
  modification:
    "Xiang, 2026-09-23: extracted Make Me a Hanzi stroke outlines into codepoint-keyed files. Per-character recipes preserve complete dictionary stroke matches; reviewed nested groupings are identified in their recipe file. Distributed under the Arphic Public License, without warranty.",
  defaultCharacters: STARTERS,
  sampleCharacters: SAMPLES,
  glyphCount: graphics.size,
  recipeCount: recipeCharacters.length,
  recipeCharacters: recipeCharacters.sort(),
  compositionParents: compositionIndex,
};
writeFileSync(`${DATA_DIRECTORY}/scene.json`, `${JSON.stringify(manifest)}\n`);
writeFileSync(
  `${DATA_DIRECTORY}/variants.json`,
  `${JSON.stringify({
    schemaVersion: 1,
    source: "OpenCC",
    license: [
      "/data/licenses/OPENCC-MIT.txt",
      "/data/licenses/OPENCC-APACHE-2.0.txt",
    ],
    mappings: characterVariants,
    playgroundMappings: playgroundCharacterVariants,
  })}\n`,
);
mkdirSync("public/data/licenses", { recursive: true });
writeFileSync(
  "public/data/licenses/OPENCC-MIT.txt",
  `${readFileSync("node_modules/opencc-js/LICENSE", "utf8").trimEnd()}\n`,
);
writeFileSync(
  "public/data/licenses/OPENCC-APACHE-2.0.txt",
  `${readFileSync("node_modules/opencc-js/LICENSES/Apache-2.0.txt", "utf8").trimEnd()}\n`,
);
writeFileSync(
  `${DATA_DIRECTORY}/hsk1.json`,
  `${JSON.stringify({
    schemaVersion: 1,
    standard: "HSK 2.0",
    source: "https://github.com/drkameleon/complete-hsk-vocabulary",
    license: "/data/licenses/HSK-MIT.txt",
    sets: hsk1,
  })}\n`,
);

const xiangRecipe = JSON.parse(
  readFileSync(`${RECIPE_DIRECTORY}/${assetName("想")}`, "utf8"),
);
const xiangGlyph = graphics.get("想");
writeFileSync(
  `${DATA_DIRECTORY}/xiang.json`,
  `${JSON.stringify({
    character: "想",
    strokes: xiangGlyph.strokes,
    parts: xiangRecipe.parts.map((part) => ({
      char: part.character,
      strokeIndices: part.strokeIndices,
      embeddedStrokes: part.strokeIndices.map(
        (index) => xiangGlyph.strokes[index],
      ),
      standaloneStrokes: graphics.get(part.character).strokes,
    })),
    decomposition: xiangRecipe.decomposition,
    source: manifest.source,
    license: manifest.license,
    copyright: manifest.copyright,
    modification: manifest.modification,
  })}\n`,
);

console.log(
  JSON.stringify(
    {
      glyphs: graphics.size,
      eligiblePhysicalRecipes: recipeCharacters.length,
      exactBinaryMappings: exactBinaryCount,
      reviewedPairwiseGroupings: reviewedGroupingCount,
      incompleteOrUnsupportedMappings: ineligibleMappingCount,
      compatiblePairs: Object.keys(compositionIndex).length,
      hsk1Simplified: hsk1.simplified.characters.length,
      hsk1Traditional: hsk1.traditional.characters.length,
      hsk1WithoutOutlines: {
        simplified: hsk1.simplified.unavailableCharacters.length,
        traditional: hsk1.traditional.unavailableCharacters.length,
      },
      scriptMappings: {
        simplified: Object.keys(characterVariants.simplified).length,
        traditional: Object.keys(characterVariants.traditional).length,
      },
      playgroundScriptMappings: {
        simplified: Object.keys(playgroundCharacterVariants.simplified).length,
        traditional: Object.keys(playgroundCharacterVariants.traditional)
          .length,
      },
    },
    null,
    2,
  ),
);

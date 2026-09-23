import {
  createReadStream,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline";

const SAMPLE_CHARACTERS = ["想", "相", "明", "休", "好", "林", "森"];

async function findCharacters(file, characters) {
  const found = new Map();
  const source = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of source) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (characters.has(entry.character)) found.set(entry.character, entry);
    if (found.size === characters.size) break;
  }
  return found;
}

const decompositions = JSON.parse(
  readFileSync("public/data/decomp.json", "utf8"),
);
const extensions = JSON.parse(
  readFileSync("data/decomposition_extensions.json", "utf8"),
);
const parents = new Map(
  SAMPLE_CHARACTERS.map((character) => [character, decompositions[character]]),
);
const childCharacters = [
  ...new Set(
    SAMPLE_CHARACTERS.flatMap(
      (character) =>
        extensions[character]?.playground?.children ?? parents.get(character),
    ),
  ),
];
const allCharacters = new Set([...SAMPLE_CHARACTERS, ...childCharacters]);
const [graphics, dictionary] = await Promise.all([
  findCharacters("data/makemeahanzi/graphics.txt", allCharacters),
  findCharacters(
    "data/makemeahanzi/dictionary.txt",
    new Set(SAMPLE_CHARACTERS),
  ),
]);

const recipes = [];
for (const character of SAMPLE_CHARACTERS) {
  const playgroundRecipe = extensions[character]?.playground;
  const children = playgroundRecipe?.children ?? parents.get(character);
  const parent = dictionary.get(character);
  const glyph = graphics.get(character);
  if (
    !Array.isArray(children) ||
    children.length !== 2 ||
    !glyph?.strokes?.length ||
    !parent?.matches ||
    (playgroundRecipe &&
      (!playgroundRecipe.reason ||
        !Array.isArray(playgroundRecipe.strokePathPrefixes) ||
        playgroundRecipe.strokePathPrefixes.length !== children.length))
  ) {
    throw new Error(`Missing complete two-child source data for ${character}.`);
  }
  const parts = children.map((child, childIndex) => {
    const strokeIndices = parent.matches
      .map((match, strokeIndex) => {
        if (playgroundRecipe) {
          const prefixes = playgroundRecipe.strokePathPrefixes[childIndex];
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
    const standalone = graphics.get(child);
    if (!strokeIndices.length || !standalone?.strokes?.length) {
      throw new Error(`Missing reviewed stroke group ${character} → ${child}.`);
    }
    return {
      char: child,
      strokeIndices,
      embeddedStrokes: strokeIndices.map((i) => glyph.strokes[i]),
    };
  });
  const assignedStrokes = parts.flatMap((part) => part.strokeIndices);
  if (
    assignedStrokes.length !== glyph.strokes.length ||
    new Set(assignedStrokes).size !== glyph.strokes.length ||
    assignedStrokes.some(
      (strokeIndex) => strokeIndex < 0 || strokeIndex >= glyph.strokes.length,
    )
  ) {
    throw new Error(
      `The reviewed stroke groups for ${character} are incomplete or overlap.`,
    );
  }
  recipes.push({
    char: character,
    decomposition: parent.decomposition,
    strokes: glyph.strokes,
    parts,
  });
}

const glyphs = Object.fromEntries(
  [...allCharacters].sort().map((character) => {
    const glyph = graphics.get(character);
    if (!glyph?.strokes?.length)
      throw new Error(`Missing glyph for ${character}.`);
    return [character, glyph.strokes];
  }),
);
const output = {
  source: "https://github.com/skishore/makemeahanzi",
  license: "/data/licenses/ARPHICPL.TXT",
  copyright: "Copyright (C) 1999 Arphic Technology Co., Ltd.",
  modification:
    "Xiang, 2026-09-23: extracted original glyph outlines for 想, 相, 明, 休, 好, 林, 森, and their reviewed pairwise playground recipes. Stroke membership is derived from dictionary.txt matches; for 森, its lower nested 木 + 木 group is reviewed as 林. Component placements are derived at runtime from these unaltered outlines. Distributed under the Arphic Public License, without warranty.",
  glyphs,
  recipes,
};
mkdirSync("public/data/playground", { recursive: true });
writeFileSync(
  "public/data/playground/scene.json",
  `${JSON.stringify(output)}\n`,
);

// Preserve the original one-character playground asset for existing links.
const xiang = recipes.find((recipe) => recipe.char === "想");
writeFileSync(
  "public/data/playground/xiang.json",
  `${JSON.stringify({
    character: xiang.char,
    strokes: xiang.strokes,
    parts: xiang.parts.map((part) => ({
      ...part,
      standaloneStrokes: glyphs[part.char],
    })),
    decomposition: xiang.decomposition,
    ...Object.fromEntries(
      ["source", "license", "copyright", "modification"].map((key) => [
        key,
        output[key],
      ]),
    ),
  })}\n`,
);
console.log(
  `Generated ${recipes.length} reviewed character recipes and ${Object.keys(glyphs).length} glyphs.`,
);

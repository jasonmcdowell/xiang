import { publicAssetUrl } from "./publicAssetUrl";
import type { PlaygroundAssets } from "./playgroundWorld";

export type PlaygroundManifest = {
  schemaVersion: number;
  defaultCharacters: string[];
  sampleCharacters: string[];
  glyphCount: number;
  recipeCount: number;
  recipeCharacters: string[];
  compositionParents: Record<string, string[]>;
};

export type PlaygroundHsk1 = {
  schemaVersion: 1;
  standard: "HSK 2.0";
  source: string;
  license: string;
  sets: Record<"simplified" | "traditional", PlaygroundHskSet>;
};

export type PlaygroundHskSet = {
  total: number;
  characters: string[];
  unavailableCharacters: string[];
};

export type PlaygroundDictionary = Record<
  string,
  { pinyin: string[]; definition: string }
>;

type GlyphFile = { character: string; strokes: string[] };
type RecipeFile = {
  character: string;
  decomposition: string;
  parts: { character: string; strokeIndices: number[] }[];
};

const glyphCache = new Map<string, Promise<GlyphFile>>();
const recipeCache = new Map<string, Promise<RecipeFile>>();
let dictionaryCache: Promise<PlaygroundDictionary> | null = null;
const codepointName = (character: string) => {
  const codepoint = character.codePointAt(0);
  if (codepoint === undefined || Array.from(character).length !== 1)
    throw new Error("Enter one character at a time.");
  return `${codepoint.toString(16).toUpperCase().padStart(4, "0")}.json`;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(publicAssetUrl(path));
  if (!response.ok)
    throw new Error(`Character data unavailable (${response.status}).`);
  return (await response.json()) as T;
}

function loadGlyph(character: string) {
  const existing = glyphCache.get(character);
  if (existing) return existing;
  const request = fetchJson<GlyphFile>(
    `data/playground/glyphs/${codepointName(character)}`,
  ).then((glyph) => {
    if (glyph.character !== character || !glyph.strokes.length)
      throw new Error(`No usable stroke outline was found for ${character}.`);
    return glyph;
  });
  glyphCache.set(character, request);
  void request.catch(() => glyphCache.delete(character));
  return request;
}

function loadRecipe(character: string) {
  const existing = recipeCache.get(character);
  if (existing) return existing;
  const request = fetchJson<RecipeFile>(
    `data/playground/recipes/${codepointName(character)}`,
  ).then((recipe) => {
    if (
      recipe.character !== character ||
      recipe.parts.length !== 2 ||
      recipe.parts.some((part) => !part.strokeIndices.length)
    )
      throw new Error(
        `The reviewed component mapping for ${character} is incomplete.`,
      );
    return recipe;
  });
  recipeCache.set(character, request);
  void request.catch(() => recipeCache.delete(character));
  return request;
}

export async function loadPlaygroundManifest() {
  const manifest = await fetchJson<PlaygroundManifest>(
    "data/playground/scene.json",
  );
  if (manifest.schemaVersion !== 2 || !manifest.compositionParents)
    throw new Error("The playground character catalog is incomplete.");
  return manifest;
}

export async function loadPlaygroundHsk1(): Promise<PlaygroundHsk1> {
  const catalog = await fetchJson<PlaygroundHsk1>("data/playground/hsk1.json");
  if (
    catalog.schemaVersion !== 1 ||
    catalog.standard !== "HSK 2.0" ||
    !catalog.sets?.simplified?.characters ||
    !catalog.sets?.traditional?.characters ||
    catalog.sets.simplified.total !==
      catalog.sets.simplified.characters.length +
        catalog.sets.simplified.unavailableCharacters.length ||
    catalog.sets.traditional.total !==
      catalog.sets.traditional.characters.length +
        catalog.sets.traditional.unavailableCharacters.length
  )
    throw new Error("The HSK 1 character catalog is incomplete.");
  return catalog;
}

export function loadPlaygroundDictionary(): Promise<PlaygroundDictionary> {
  if (!dictionaryCache) {
    dictionaryCache = fetchJson<PlaygroundDictionary>("data/meta.json").catch(
      (error) => {
        dictionaryCache = null;
        throw error;
      },
    );
  }
  return dictionaryCache;
}

/**
 * Load current board characters and one decomposition step ahead, plus
 * explicitly requested composition candidates. The child recipes are not
 * expanded recursively. Stroke paths remain split into one static file per
 * character and are shared by this page-session cache.
 */
export async function loadPlaygroundAssets(
  visibleCharacters: string[],
  manifest: PlaygroundManifest,
  compositionParents: string[] = [],
): Promise<PlaygroundAssets> {
  const recipeCharacters = new Set(manifest.recipeCharacters);
  const parents = [
    ...new Set([...visibleCharacters, ...compositionParents]),
  ].filter((character) => recipeCharacters.has(character));
  const [visibleGlyphs, primaryRecipes] = await Promise.all([
    Promise.all([...new Set(visibleCharacters)].map(loadGlyph)),
    Promise.all(parents.map(loadRecipe)),
  ]);
  const visibleSet = new Set(visibleCharacters);
  const prefetchChildren = [
    ...new Set(
      primaryRecipes
        .filter((recipe) => visibleSet.has(recipe.character))
        .flatMap((recipe) => recipe.parts.map((part) => part.character)),
    ),
  ].filter(
    (character) =>
      recipeCharacters.has(character) && !parents.includes(character),
  );
  const childRecipes = await Promise.all(prefetchChildren.map(loadRecipe));
  const recipeFiles = await Promise.all(
    [...primaryRecipes, ...childRecipes].map(async (recipe) => ({
      recipe,
      glyph:
        visibleGlyphs.find((glyph) => glyph.character === recipe.character) ??
        (await loadGlyph(recipe.character)),
    })),
  );
  const componentCharacters = recipeFiles.flatMap(({ recipe }) =>
    recipe.parts.map((part) => part.character),
  );
  const glyphs = await Promise.all(
    [
      ...new Set([
        ...visibleGlyphs.map((glyph) => glyph.character),
        ...componentCharacters,
      ]),
    ]
      .filter(
        (character) =>
          !visibleGlyphs.some((glyph) => glyph.character === character),
      )
      .map(loadGlyph),
  );
  const allGlyphs = [
    ...new Map(
      [
        ...visibleGlyphs,
        ...recipeFiles.map(({ glyph }) => glyph),
        ...glyphs,
      ].map((glyph) => [glyph.character, glyph]),
    ).values(),
  ];

  return {
    glyphs: Object.fromEntries(
      allGlyphs.map((glyph) => [glyph.character, glyph.strokes]),
    ),
    recipes: recipeFiles.map(({ recipe, glyph }) => ({
      char: recipe.character,
      decomposition: recipe.decomposition,
      strokes: glyph.strokes,
      parts: recipe.parts.map((part) => ({
        char: part.character,
        strokeIndices: part.strokeIndices,
        embeddedStrokes: part.strokeIndices.map((index) => {
          const stroke = glyph.strokes[index];
          if (!stroke)
            throw new Error(
              `Invalid stroke index in the recipe for ${recipe.character}.`,
            );
          return stroke;
        }),
      })),
    })),
    compositionParents: manifest.compositionParents,
  };
}

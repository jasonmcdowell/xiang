import { STEP, WobbleBody, type Point } from "./wobble";
import {
  componentLayout,
  connectAtSeam,
  coupleComponents,
  type ComponentLayout,
  type Tether,
} from "./wobbleComponents";
import {
  facingBinding,
  hitInk,
  hitTileFace,
  inkCenter,
  measureGlyph,
  projectInkPoint,
  skinStrokes,
  type GlyphGeometry,
  type Ink,
  type InkLayer,
  type VisualStyle,
} from "./wobbleDrawing";

export type PhysicsMode = "fixed" | "weighted";
export type PlaygroundAssets = {
  glyphs: Record<string, string[]>;
  recipes: {
    char: string;
    decomposition: string;
    strokes: string[];
    parts: {
      char: string;
      strokeIndices: number[];
      embeddedStrokes: string[];
    }[];
  }[];
  compositionParents?: Record<string, string[]>;
};

export type PlaygroundWorldEvent =
  | { type: "tear"; character: string }
  | { type: "compose"; character: string }
  | { type: "unfold"; character: string };

type PartAsset = PlaygroundAssets["recipes"][number]["parts"][number] & {
  embeddedGeometry: GlyphGeometry;
  standaloneGeometry: GlyphGeometry;
  layout: ComponentLayout;
};
type Recipe = Omit<PlaygroundAssets["recipes"][number], "parts"> & {
  parts: [PartAsset, PartAsset];
};
type SceneObject = {
  id: number;
  char: string;
  body: WobbleBody;
  surfaceBody: WobbleBody;
  ink: Ink;
  free: boolean;
  componentPiece: boolean;
  recipe: Recipe | null;
  tileFollowsInkUntilRelease: boolean;
  tileFollowOffset: Point | null;
};

type StartingTile = { char: string; center: Point };
type Contact = {
  entityId: number;
  group: number | null;
  binding: ReturnType<WobbleBody["bind"]>;
  target: Point;
  body: WobbleBody;
  surfaceBody: WobbleBody;
  tileGrip: boolean;
};
type TearPreview = {
  source: SceneObject;
  partIndex: number;
  restBody: WobbleBody;
  partBody: WobbleBody;
  restInk: Ink;
  partInk: Ink;
  tethers: Tether[];
};
type MagnetMatch = {
  recipe: Recipe;
  a: SceneObject;
  b: SceneObject;
  contactKind: "tiles" | "ink";
  layoutA: ComponentLayout;
  layoutB: ComponentLayout;
  anchorA: Point;
  anchorB: Point;
  errorX: number;
  errorY: number;
  distance: number;
  overlapX: number;
  overlapY: number;
  overlapDepth: number;
  parentScaleX: number;
  parentScaleY: number;
};
type TearPlan = {
  placements: {
    center: Point;
    layout: ComponentLayout;
    face: { width: number; height: number };
  }[];
  clearance: {
    x: number;
    y: number;
    requiredX: number;
    requiredY: number;
    withinBoard: boolean;
    ready: boolean;
  };
};

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const TILE_FACE_INSET = 38;
const TILE_FACE_SIZE = 156;
const TILE_CLEARANCE = 10;
const DEFAULT_GLYPH_SCALE = 0.36;
const TILE_OVERLAP_EPSILON = 0.01;
const MAGNET_FULL_ALIGNMENT_DISTANCE = TILE_FACE_SIZE + TILE_CLEARANCE * 3;
const MAGNET_FAR_ALIGNMENT_STRENGTH = 0.15;
const MAGNET_FULL_STRENGTH_OVERLAP = 32;
const TILE_REPULSION_RANGE = 22;
const TILE_REPULSION_FORCE = 18;
const compositionKey = (a: string, b: string) => [a, b].sort().join("|");

export class PlaygroundWorld {
  private readonly assets: PlaygroundAssets;
  private readonly glyphGeometries = new Map<string, GlyphGeometry>();
  private recipes: Recipe[] = [];
  private recipeByChar = new Map<string, Recipe>();
  private objects: SceneObject[] = [];
  private customStarts: StartingTile[] | null = null;
  private preview: TearPreview | null = null;
  private contacts = new Map<number, Contact>();
  private events: PlaygroundWorldEvent[] = [];
  private nextId = 1;
  private elapsed = 0;
  private readonly snapRadius = 12;
  phase: "whole" | "stretching" | "loose" = "whole";
  message = "Pull a component outward. Stretch its seam to tear it free.";
  selectedCharacter = "想";
  boardPreset: "starters" | "single" | "custom" = "starters";
  physicsMode: PhysicsMode = "fixed";
  visualStyle: VisualStyle = "raised";
  tileRepulsion = true;
  softness = 0.55;
  reduced = false;

  constructor(
    private width: number,
    private height: number,
    assets: PlaygroundAssets,
  ) {
    this.assets = assets;
    this.compileAssets();
    this.resetStarters();
  }

  private compileAssets() {
    this.glyphGeometries.clear();
    for (const [char, strokes] of Object.entries(this.assets.glyphs))
      this.glyphGeometries.set(char, measureGlyph(strokes));
    const parentBody = new WobbleBody(this.width, this.height);
    this.recipes = this.assets.recipes.map((recipe) => ({
      ...recipe,
      parts: recipe.parts.map((part) => {
        const standaloneGeometry = this.glyphGeometries.get(part.char);
        if (!standaloneGeometry)
          throw new Error(`Missing component outline for ${part.char}.`);
        const embeddedGeometry = measureGlyph(part.embeddedStrokes);
        return {
          ...part,
          embeddedGeometry,
          standaloneGeometry,
          layout: componentLayout(
            parentBody,
            embeddedGeometry,
            standaloneGeometry,
          ),
        };
      }) as [PartAsset, PartAsset],
    }));
    this.recipeByChar = new Map(
      this.recipes.map((recipe) => [recipe.char, recipe]),
    );
  }

  registerAssets(assets: PlaygroundAssets) {
    const existingRecipes = new Set(
      this.objects.map((object) => object.recipe?.char),
    );
    const newRecipes = assets.recipes.filter(
      (recipe) => !this.recipeByChar.has(recipe.char),
    );
    if (assets.compositionParents)
      this.assets.compositionParents = assets.compositionParents;
    const newGlyphs = Object.fromEntries(
      Object.entries(assets.glyphs).filter(
        ([character]) => !this.assets.glyphs[character],
      ),
    );
    if (!Object.keys(newGlyphs).length && !newRecipes.length) return;
    Object.assign(this.assets.glyphs, newGlyphs);
    this.assets.recipes.push(...newRecipes);
    this.compileAssets();
    for (const object of this.objects)
      object.recipe = this.recipeByChar.get(object.char) ?? null;
    const newlyReady = this.objects
      .filter((object) => object.recipe && !existingRecipes.has(object.char))
      .map((object) => object.char);
    if (newlyReady.length && this.phase === "loose" && !this.preview)
      this.message = `Component strokes are ready for ${newlyReady.join(", ")}. Pull one to continue.`;
  }

  charactersOnBoard() {
    return this.objects.map((object) => object.char);
  }

  hasRecipeFor(character: string) {
    return this.recipeByChar.has(character);
  }

  compositionAssetCandidates() {
    const index = this.assets.compositionParents ?? {};
    const candidates = new Set<string>();
    for (let i = 0; i < this.objects.length; i++) {
      const a = this.objects[i];
      if (!a.free) continue;
      for (let j = i + 1; j < this.objects.length; j++) {
        const b = this.objects[j];
        if (!b.free) continue;
        for (const parent of index[compositionKey(a.char, b.char)] ?? [])
          if (!this.recipeByChar.has(parent)) candidates.add(parent);
      }
    }
    return [...candidates];
  }

  get pointerIds() {
    return [...this.contacts.keys()];
  }

  pointerTarget(pointerId: number) {
    const contact = this.contacts.get(pointerId);
    if (!contact) return null;
    const object = this.objects.find(
      (candidate) => candidate.id === contact.entityId,
    );
    const character = object?.char ?? this.preview?.source.char ?? null;
    return character ? { id: contact.entityId, character } : null;
  }

  get isReady() {
    return this.objects.length > 0;
  }

  get tileCount() {
    return this.objects.length;
  }

  private allBodies() {
    const bodies = this.objects.flatMap((object) => [
      object.body,
      object.surfaceBody,
    ]);
    if (this.preview) bodies.push(this.preview.restBody, this.preview.partBody);
    return bodies;
  }

  private setBodyMode(body: WobbleBody, free: boolean) {
    body.softness = this.softness;
    body.reduced = this.reduced;
    body.grabStrength = free ? 1.25 : this.physicsMode === "fixed" ? 0.8 : 0.42;
    body.setFixed(!free && this.physicsMode === "fixed");
  }

  private createObject(
    char: string,
    center: Point,
    free: boolean,
    scaleX = DEFAULT_GLYPH_SCALE,
    scaleY = DEFAULT_GLYPH_SCALE,
    velocity: Point = { x: 0, y: 0 },
    componentPiece = false,
  ): SceneObject {
    const strokes = this.assets.glyphs[char];
    if (!strokes) throw new Error(`Missing playground glyph for ${char}.`);
    const body = new WobbleBody(this.width, this.height, scaleX, scaleY);
    const surfaceSize = Math.min(390, this.width * 0.8, this.height * 0.75);
    const tileScale = (TILE_FACE_SIZE - TILE_FACE_INSET) / surfaceSize;
    const surfaceBody = new WobbleBody(
      this.width,
      this.height,
      tileScale,
      tileScale,
    );
    body.setCenter(center.x, center.y);
    surfaceBody.setCenter(center.x, center.y);
    body.setVelocity(velocity.x, velocity.y);
    this.setBodyMode(body, free);
    this.setBodyMode(surfaceBody, free);
    return {
      id: this.nextId++,
      char,
      body,
      surfaceBody,
      ink: skinStrokes(strokes, body),
      free,
      componentPiece,
      recipe: this.recipeByChar.get(char) ?? null,
      tileFollowsInkUntilRelease: false,
      tileFollowOffset: null,
    };
  }

  private setPhase(phase: "whole" | "stretching" | "loose", message: string) {
    this.phase = phase;
    this.message = message;
  }

  setMode(mode: PhysicsMode) {
    this.physicsMode = mode;
    for (const object of this.objects) {
      this.setBodyMode(object.body, object.free);
      this.setBodyMode(object.surfaceBody, object.free);
    }
    if (this.preview) {
      this.setBodyMode(this.preview.restBody, false);
      this.setBodyMode(this.preview.partBody, true);
    }
  }

  setVisualStyle(style: VisualStyle) {
    this.visualStyle = style;
  }

  setTileRepulsion(enabled: boolean) {
    this.tileRepulsion = enabled;
  }

  takeEvents() {
    return this.events.splice(0);
  }

  private containsInk(
    point: Point,
    ink: Ink,
    body: WobbleBody,
    surface: WobbleBody,
  ) {
    const style = this.visualStyle;
    const surfacePose = surface.pose();
    return hitInk(point, ink, body, (binding) => {
      const position = body.at(binding);
      const reference = style !== "draped" ? position : body.idealAt(binding);
      return projectInkPoint(
        position,
        surface,
        body,
        style,
        reference,
        surfacePose,
      ).point;
    });
  }

  setSoftness(softness: number) {
    this.softness = clamp(softness, 0, 1);
    for (const body of this.allBodies()) body.softness = this.softness;
  }

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
    for (const body of this.allBodies()) body.reduced = reduced;
  }

  reset(char?: string) {
    if (char === undefined && this.boardPreset === "starters") {
      this.resetStarters();
      return;
    }
    if (
      char === undefined &&
      this.boardPreset === "custom" &&
      this.customStarts?.length
    ) {
      this.resetCustomBoard();
      return;
    }
    this.cancelAll();
    this.events.length = 0;
    this.boardPreset = "single";
    this.customStarts = null;
    this.selectedCharacter = char ?? this.selectedCharacter;
    if (!this.assets.glyphs[this.selectedCharacter])
      throw new Error(
        `Missing playground glyph for ${this.selectedCharacter}.`,
      );
    this.objects = [
      this.createObject(
        this.selectedCharacter,
        { x: this.width / 2, y: this.height / 2 },
        false,
      ),
    ];
    this.preview = null;
    this.setPhase(
      "whole",
      this.recipeByChar.has(this.selectedCharacter)
        ? "Pull a component outward. Stretch its seam to tear it free."
        : `${this.selectedCharacter} has an outline, but no complete physical component mapping yet.`,
    );
  }

  addCharacter(char: string): "added" | "busy" | "full" {
    if (this.contacts.size || this.preview) {
      this.message = "Finish the current drag before adding a character.";
      return "busy";
    }
    if (!this.assets.glyphs[char])
      throw new Error(`Missing playground glyph for ${char}.`);
    const center = this.findOpenTileCenter();
    if (!center) {
      this.message =
        "There isn’t room for another tile. Move a tile and try again.";
      return "full";
    }
    if (this.boardPreset !== "custom")
      this.customStarts = this.objects.map((object) => ({
        char: object.char,
        center: { ...object.surfaceBody.pose() },
      }));
    this.customStarts ??= [];
    this.customStarts.push({ char, center: { ...center } });
    this.boardPreset = "custom";
    this.selectedCharacter = char;
    this.objects.push(this.createObject(char, center, false));
    this.message = this.recipeByChar.has(char)
      ? `${char} added as a new tile. Pull a component or combine it with another character.`
      : `${char} added as a new tile. It has an outline but no complete physical component mapping.`;
    return "added";
  }

  unfoldTile(
    id: number,
  ): "unfolded" | "busy" | "missing" | "unsupported" | "no-room" {
    if (this.contacts.size || this.preview) {
      this.message = "Finish the current drag before unfolding a tile.";
      return "busy";
    }
    const source = this.objects.find((object) => object.id === id);
    if (!source) return "missing";
    if (!source.recipe) {
      this.message = `${source.char} has no reviewed physical decomposition yet.`;
      return "unsupported";
    }
    const placements = this.planUnfold(source);
    if (!placements) {
      this.message = "Move a tile to make room for both components.";
      return "no-room";
    }

    const children = source.recipe.parts.map((part, index) =>
      this.createObject(
        part.char,
        placements.centers[index],
        true,
        DEFAULT_GLYPH_SCALE,
        DEFAULT_GLYPH_SCALE,
        { x: 0, y: 0 },
        true,
      ),
    );
    this.objects = [
      ...this.objects.filter((object) => object !== source),
      ...children,
    ];
    this.setPhase(
      "loose",
      `Free pieces: ${source.recipe.parts[0].char} + ${source.recipe.parts[1].char}. Pull a stroke, double-tap a tile, or bring compatible pieces together.`,
    );
    this.events.push({
      type: "unfold",
      character: source.recipe.parts[0].char,
    });
    return "unfolded";
  }

  private findOpenTileCenter(): Point | null {
    const halfSize = TILE_FACE_SIZE / 2;
    const margin = halfSize + 8;
    if (this.width < margin * 2 || this.height < margin * 2) return null;

    const occupied = this.objects.map((object) => ({
      center: object.surfaceBody.pose(),
      footprint: this.tileFootprint(object.surfaceBody),
    }));
    const candidateCoordinates = (
      size: number,
      extent: "width" | "height",
      axis: "x" | "y",
    ) => {
      const minimum = margin;
      const maximum = size - margin;
      const coordinates = new Set<number>([size / 2, minimum, maximum]);
      for (const item of occupied) {
        const separation =
          halfSize + item.footprint[extent] / 2 + TILE_CLEARANCE;
        coordinates.add(
          clamp(item.center[axis] - separation, minimum, maximum),
        );
        coordinates.add(
          clamp(item.center[axis] + separation, minimum, maximum),
        );
      }
      return [...coordinates].sort(
        (a, b) => Math.abs(a - size / 2) - Math.abs(b - size / 2),
      );
    };
    const xs = candidateCoordinates(this.width, "width", "x");
    const ys = candidateCoordinates(this.height, "height", "y");
    const candidates = xs.flatMap((x) =>
      ys.map((y) => ({
        x,
        y,
        distance: Math.hypot(x - this.width / 2, y - this.height / 2),
      })),
    );
    candidates.sort((a, b) => a.distance - b.distance);

    for (const candidate of candidates) {
      const clear = occupied.every(
        ({ center, footprint }) =>
          Math.abs(candidate.x - center.x) >=
            halfSize + footprint.width / 2 + TILE_CLEARANCE ||
          Math.abs(candidate.y - center.y) >=
            halfSize + footprint.height / 2 + TILE_CLEARANCE,
      );
      if (clear) return { x: candidate.x, y: candidate.y };
    }
    return null;
  }

  private resetCustomBoard() {
    const starts = this.customStarts;
    if (!starts?.length) return;
    this.cancelAll();
    this.events.length = 0;
    const halfSize = TILE_FACE_SIZE / 2;
    const fitCenter = (center: Point): Point => ({
      x: clamp(
        center.x,
        Math.min(halfSize + 8, this.width / 2),
        Math.max(this.width - halfSize - 8, this.width / 2),
      ),
      y: clamp(
        center.y,
        Math.min(halfSize + 8, this.height / 2),
        Math.max(this.height - halfSize - 8, this.height / 2),
      ),
    });
    this.customStarts = starts.map((start) => ({
      char: start.char,
      center: fitCenter(start.center),
    }));
    this.boardPreset = "custom";
    this.selectedCharacter = starts.at(-1)!.char;
    this.objects = this.customStarts.map((start) =>
      this.createObject(start.char, start.center, false),
    );
    this.preview = null;
    this.setPhase(
      "whole",
      `${this.objects.length} custom characters are ready. Pull a component or combine compatible tiles.`,
    );
  }

  resetStarters() {
    this.cancelAll();
    this.events.length = 0;
    this.boardPreset = "starters";
    this.customStarts = null;
    this.selectedCharacter = "想";
    const characters = ["想", "相", "明", "休", "好"];
    const columns =
      this.width >= TILE_FACE_SIZE * 3 + 80
        ? 3
        : this.width >= TILE_FACE_SIZE * 2 + TILE_CLEARANCE + 24
          ? 2
          : 1;
    const rows = Math.ceil(characters.length / columns);
    const margin = 12;
    const maxXSpan = Math.max(0, this.width - TILE_FACE_SIZE - margin * 2);
    const maxYSpan = Math.max(0, this.height - TILE_FACE_SIZE - margin * 2);
    const desiredXSpan = (columns - 1) * (TILE_FACE_SIZE + 44);
    const desiredYSpan = (rows - 1) * (TILE_FACE_SIZE + 44);
    const xSpan = Math.min(maxXSpan, Math.max(desiredXSpan, maxXSpan * 0.72));
    const ySpan = Math.min(maxYSpan, Math.max(desiredYSpan, maxYSpan * 0.72));
    this.objects = characters.map((char, index) => {
      const row = Math.floor(index / columns);
      const rowCount = Math.min(columns, characters.length - row * columns);
      const column = index % columns;
      const xStep = columns > 1 ? xSpan / (columns - 1) : 0;
      const yStep = rows > 1 ? ySpan / (rows - 1) : 0;
      const centerColumn =
        rowCount === 1 && columns > 1 ? (columns - 1) / 2 : (rowCount - 1) / 2;
      const center = {
        x: this.width / 2 + (column - centerColumn) * xStep,
        y: this.height / 2 + (row - (rows - 1) / 2) * yStep,
      };
      return this.createObject(char, center, false);
    });
    this.preview = null;
    this.setPhase(
      "whole",
      "Five starters are ready. Pull a component away from any character to explore it.",
    );
  }

  resize(width: number, height: number) {
    const selected = this.selectedCharacter;
    const preset = this.boardPreset;
    this.cancelAll();
    this.width = width;
    this.height = height;
    this.compileAssets();
    if (preset === "starters") this.resetStarters();
    else if (preset === "custom") this.resetCustomBoard();
    else this.reset(selected);
  }

  private beginTear(object: SceneObject, partIndex: number) {
    if (!object.recipe) return null;
    const part = object.recipe.parts[partIndex];
    const restIndices = object.recipe.strokes
      .map((_, index) => index)
      .filter((index) => !part.strokeIndices.includes(index));
    const restBody = object.body.copy();
    const partBody = object.body.copy();
    this.setBodyMode(restBody, false);
    this.setBodyMode(partBody, true);
    const restInk = skinStrokes(
      restIndices.map((index) => object.recipe!.strokes[index]),
      restBody,
    );
    const partInk = skinStrokes(part.embeddedStrokes, partBody);
    const preview: TearPreview = {
      source: object,
      partIndex,
      restBody,
      partBody,
      restInk,
      partInk,
      tethers: connectAtSeam(restInk, partInk, restBody, partBody),
    };
    this.preview = preview;
    this.setPhase(
      "stretching",
      `Pull ${part.char} away. The rest of ${object.char} resists and gives a little.`,
    );
    return preview;
  }

  pointerDown(point: Point, pointerId: number) {
    if (this.contacts.has(pointerId)) return false;
    let body: WobbleBody | null = null;
    let surfaceBody: WobbleBody | null = null;
    let entityId = -1;
    let group: number | null = null;
    let tileGrip = false;
    if (this.preview) {
      const restIndex = 1 - this.preview.partIndex;
      const surface = this.preview.source.surfaceBody;
      surfaceBody = surface;
      if (
        this.containsInk(
          point,
          this.preview.partInk,
          this.preview.partBody,
          surface,
        )
      ) {
        group = this.preview.partIndex;
        body = this.preview.partBody;
      } else if (
        this.containsInk(
          point,
          this.preview.restInk,
          this.preview.restBody,
          surface,
        )
      ) {
        group = restIndex;
        body = this.preview.restBody;
      } else return false;
      entityId = this.preview.source.id;
    } else {
      for (const object of [...this.objects].reverse()) {
        surfaceBody = object.surfaceBody;
        const onInk = this.containsInk(
          point,
          object.ink,
          object.body,
          surfaceBody,
        );
        const onTile =
          this.visualStyle !== "flat" && hitTileFace(point, object.surfaceBody);
        if (!onInk && !onTile) continue;
        // If no reviewed tear recipe exists, an ink drag cannot detach a
        // component. In raised/draped modes let that gesture move the whole
        // tile instead of only stretching the strokes and snapping them back.
        if (
          onTile &&
          (!onInk || (!object.recipe && !object.componentPiece))
        ) {
          body = object.body;
          entityId = object.id;
          tileGrip = true;
          break;
        }
        if (onInk && object.recipe) {
          if (
            [...this.contacts.values()].some(
              (contact) => contact.entityId === object.id && contact.tileGrip,
            )
          )
            return false;
          const hit = object.recipe.parts.findIndex((part) =>
            this.containsInk(
              point,
              skinStrokes(part.embeddedStrokes, object.body),
              object.body,
              object.surfaceBody,
            ),
          );
          if (hit >= 0) {
            const preview = this.beginTear(object, hit);
            if (!preview) continue;
            group = hit;
            body = preview.partBody;
          }
        }
        if (!body) body = object.body;
        entityId = object.id;
        break;
      }
      if (!body) return false;
    }
    if (!surfaceBody) return false;
    const binding = tileGrip
      ? surfaceBody.startWholeDrag(point, pointerId)
      : body.start(point, pointerId);
    if (tileGrip) body.setVelocity(0, 0);
    this.contacts.set(pointerId, {
      entityId,
      group,
      binding,
      target: point,
      body,
      surfaceBody,
      tileGrip,
    });
    return true;
  }

  pointerMove(point: Point, pointerId: number) {
    const contact = this.contacts.get(pointerId);
    if (!contact) return;
    contact.target = point;
    if (contact.tileGrip) this.moveTileGrip(contact, point, pointerId);
    else contact.body.move(point, pointerId);
  }

  private moveTileGrip(contact: Contact, point: Point, pointerId: number) {
    const surfaceBody = contact.surfaceBody;
    if (!surfaceBody) return;
    const before = surfaceBody.pose();
    surfaceBody.moveWhole(point, pointerId);
    const after = surfaceBody.pose();
    contact.body.translate(after.x - before.x, after.y - before.y);
    contact.body.setVelocity(0, 0);
  }

  private rollbackTear() {
    const preview = this.preview;
    if (!preview) return;
    const total = preview.source.recipe!.strokes.length;
    const selectedCount =
      preview.source.recipe!.parts[preview.partIndex].strokeIndices.length;
    preview.source.body = WobbleBody.blend(
      preview.restBody,
      preview.partBody,
      selectedCount / total,
    );
    preview.source.ink = skinStrokes(
      preview.source.recipe!.strokes,
      preview.source.body,
    );
    this.setBodyMode(preview.source.body, preview.source.free);
    if (preview.source.body.fixed) {
      const anchor = preview.source.body.fixedCenter;
      preview.source.body.setCenter(anchor.x, anchor.y);
    }
    this.preview = null;
    this.setPhase(
      "whole",
      `Still together: ${preview.source.char}. Try a longer pull.`,
    );
  }

  pointerUp(point: Point, pointerId: number) {
    const contact = this.contacts.get(pointerId);
    if (!contact) return;
    if (contact.tileGrip) {
      this.moveTileGrip(contact, point, pointerId);
      contact.surfaceBody.releaseWhole(pointerId);
    } else {
      contact.body.move(point, pointerId);
      contact.body.release(pointerId);
    }
    this.contacts.delete(pointerId);
    if (this.preview) {
      const remaining = [...this.contacts.values()].some(
        (other) => other.entityId === this.preview!.source.id,
      );
      if (!remaining) this.rollbackTear();
    }
  }

  pointerCancel(pointerId: number) {
    const contact = this.contacts.get(pointerId);
    if (!contact) return;
    if (contact.tileGrip) {
      contact.surfaceBody.releaseWhole(pointerId);
      contact.surfaceBody.setVelocity(0, 0);
      contact.body.setVelocity(0, 0);
    } else contact.body.release(pointerId);
    this.contacts.delete(pointerId);
    if (
      this.preview &&
      ![...this.contacts.values()].some(
        (other) => other.entityId === this.preview!.source.id,
      )
    )
      this.rollbackTear();
  }

  cancelAll() {
    for (const [pointerId, contact] of this.contacts)
      if (contact.tileGrip) contact.surfaceBody.releaseWhole(pointerId);
      else contact.body.release(pointerId);
    this.contacts.clear();
    if (this.preview) this.rollbackTear();
    for (const object of this.objects) {
      object.body.stop();
      object.surfaceBody.stop();
    }
  }

  nudge(x = 1, y = 0) {
    if (this.preview) {
      this.preview.restBody.nudge(x, y);
      this.preview.partBody.nudge(x, y);
    } else for (const object of this.objects) object.body.nudge(x, y);
  }

  private tileDimensions(surfaceBody: WobbleBody) {
    return {
      width: surfaceBody.size * surfaceBody.scaleX + TILE_FACE_INSET,
      height: surfaceBody.size * surfaceBody.scaleY + TILE_FACE_INSET,
    };
  }

  private tileFootprint(surfaceBody: WobbleBody) {
    const dimensions = this.tileDimensions(surfaceBody);
    const angle = surfaceBody.pose().angle;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    return {
      width: cos * dimensions.width + sin * dimensions.height,
      height: sin * dimensions.width + cos * dimensions.height,
    };
  }

  private tileOverlap(a: WobbleBody, b: WobbleBody) {
    const centerA = a.pose();
    const centerB = b.pose();
    const dimensionsA = this.tileDimensions(a);
    const dimensionsB = this.tileDimensions(b);
    const angleA = centerA.angle;
    const angleB = centerB.angle;
    const axes = [
      { x: Math.cos(angleA), y: Math.sin(angleA) },
      { x: -Math.sin(angleA), y: Math.cos(angleA) },
      { x: Math.cos(angleB), y: Math.sin(angleB) },
      { x: -Math.sin(angleB), y: Math.cos(angleB) },
    ];
    let depth = Number.POSITIVE_INFINITY;
    for (const axis of axes) {
      const radius = (
        dimensions: { width: number; height: number },
        angle: number,
      ) =>
        (dimensions.width / 2) *
          Math.abs(axis.x * Math.cos(angle) + axis.y * Math.sin(angle)) +
        (dimensions.height / 2) *
          Math.abs(-axis.x * Math.sin(angle) + axis.y * Math.cos(angle));
      const overlap =
        radius(dimensionsA, angleA) +
        radius(dimensionsB, angleB) -
        Math.abs(
          (centerB.x - centerA.x) * axis.x + (centerB.y - centerA.y) * axis.y,
        );
      if (overlap <= TILE_OVERLAP_EPSILON) return null;
      depth = Math.min(depth, overlap);
    }
    const footprintA = this.tileFootprint(a);
    const footprintB = this.tileFootprint(b);
    const x =
      (footprintA.width + footprintB.width) / 2 -
      Math.abs(centerA.x - centerB.x);
    const y =
      (footprintA.height + footprintB.height) / 2 -
      Math.abs(centerA.y - centerB.y);
    return x > TILE_OVERLAP_EPSILON && y > TILE_OVERLAP_EPSILON
      ? { x, y, depth }
      : null;
  }

  private heldInkOnFace(source: SceneObject, target: SceneObject) {
    const targetPose = target.surfaceBody.pose();
    const targetSize = this.tileDimensions(target.surfaceBody);
    const halfWidth = targetSize.width / 2;
    const halfHeight = targetSize.height / 2;
    const cos = Math.cos(targetPose.angle);
    const sin = Math.sin(targetPose.angle);
    for (const contact of this.contacts.values()) {
      if (contact.entityId !== source.id || contact.tileGrip) continue;
      const dx = contact.target.x - targetPose.x;
      const dy = contact.target.y - targetPose.y;
      const localX = cos * dx + sin * dy;
      const localY = -sin * dx + cos * dy;
      const overlapX = halfWidth - Math.abs(localX);
      const overlapY = halfHeight - Math.abs(localY);
      if (overlapX > TILE_OVERLAP_EPSILON && overlapY > TILE_OVERLAP_EPSILON)
        return {
          x: overlapX,
          y: overlapY,
          depth: Math.min(overlapX, overlapY),
        };
    }
    return null;
  }

  private facesClear(
    centerA: Point,
    faceA: { width: number; height: number },
    centerB: Point,
    faceB: { width: number; height: number },
  ) {
    return (
      Math.abs(centerA.x - centerB.x) >=
        (faceA.width + faceB.width) / 2 + TILE_CLEARANCE ||
      Math.abs(centerA.y - centerB.y) >=
        (faceA.height + faceB.height) / 2 + TILE_CLEARANCE
    );
  }

  private planUnfold(source: SceneObject) {
    const recipe = source.recipe;
    if (!recipe) return null;
    const layouts = recipe.parts.map((part) =>
      componentLayout(
        source.body,
        part.embeddedGeometry,
        part.standaloneGeometry,
      ),
    );
    const parent = source.surfaceBody.pose();
    const baseCenters = layouts.map((layout) => ({
      x: parent.x + layout.bodyOffset.x,
      y: parent.y + layout.bodyOffset.y,
    }));
    const [first, second] = baseCenters;
    let dx = second.x - first.x;
    let dy = second.y - first.y;
    const face = { width: TILE_FACE_SIZE, height: TILE_FACE_SIZE };
    // Leave a pixel of slack so the exact target doesn't fail clearance from
    // floating-point rounding after the component vector is rescaled.
    const required = TILE_FACE_SIZE + TILE_CLEARANCE + 1;
    if (!this.facesClear(first, face, second, face)) {
      const ratioX = Math.abs(dx) / required;
      const ratioY = Math.abs(dy) / required;
      if (ratioX === 0 && ratioY === 0) dx = required;
      else {
        const dominant = Math.max(ratioX, ratioY);
        const factor = 1 / dominant;
        dx *= factor;
        dy *= factor;
      }
    }
    const midpoint = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    const splitCenters = [
      { x: midpoint.x - dx / 2, y: midpoint.y - dy / 2 },
      { x: midpoint.x + dx / 2, y: midpoint.y + dy / 2 },
    ];
    if (!this.facesClear(splitCenters[0], face, splitCenters[1], face))
      return null;

    const existing = this.objects.filter((object) => object !== source);
    const step = Math.round(TILE_FACE_SIZE / 3);
    const maxRing = Math.ceil(Math.max(this.width, this.height) / step);
    const offsets: Point[] = [{ x: 0, y: 0 }];
    for (let ring = 1; ring <= maxRing; ring++)
      for (let x = -ring; x <= ring; x++)
        for (let y = -ring; y <= ring; y++)
          if (Math.max(Math.abs(x), Math.abs(y)) === ring)
            offsets.push({ x: x * step, y: y * step });
    offsets.sort(
      (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
    );

    for (const offset of offsets) {
      const centers = splitCenters.map((center) => ({
        x: center.x + offset.x,
        y: center.y + offset.y,
      }));
      const withinBoard = centers.every(
        (center) =>
          center.x >= face.width / 2 &&
          center.x <= this.width - face.width / 2 &&
          center.y >= face.height / 2 &&
          center.y <= this.height - face.height / 2,
      );
      if (!withinBoard) continue;
      const clearOfExisting = centers.every((center) =>
        existing.every((object) =>
          this.facesClear(
            center,
            face,
            object.surfaceBody.pose(),
            this.tileFootprint(object.surfaceBody),
          ),
        ),
      );
      if (clearOfExisting) return { centers };
    }
    return null;
  }

  private planTear(preview: TearPreview): TearPlan {
    const source = preview.source;
    const recipe = source.recipe!;
    const placements = recipe.parts.map((part, index) => {
      const layout = componentLayout(
        source.body,
        part.embeddedGeometry,
        part.standaloneGeometry,
      );
      const groupInk =
        index === preview.partIndex ? preview.partInk : preview.restInk;
      const groupBody =
        index === preview.partIndex ? preview.partBody : preview.restBody;
      const embeddedCenter = inkCenter(groupInk, groupBody);
      return {
        layout,
        center: {
          x: embeddedCenter.x - layout.standaloneOffset.x,
          y: embeddedCenter.y - layout.standaloneOffset.y,
        },
        face: this.tileDimensions(source.surfaceBody),
      };
    });
    const [first, second] = placements;
    const face = this.tileDimensions(source.surfaceBody);
    const requiredX = face.width + TILE_CLEARANCE;
    const requiredY = face.height + TILE_CLEARANCE;
    const x = Math.abs(second.center.x - first.center.x);
    const y = Math.abs(second.center.y - first.center.y);
    const withinBoard = placements.every(
      ({ center, face: tileFace }) =>
        center.x >= tileFace.width / 2 &&
        center.x <= this.width - tileFace.width / 2 &&
        center.y >= tileFace.height / 2 &&
        center.y <= this.height - tileFace.height / 2,
    );
    let ready =
      this.facesClear(first.center, first.face, second.center, second.face) &&
      withinBoard;
    const existing = this.objects.filter((object) => object !== source);
    for (const placement of placements)
      for (const object of existing)
        ready =
          ready &&
          this.facesClear(
            placement.center,
            placement.face,
            object.surfaceBody.pose(),
            this.tileFootprint(object.surfaceBody),
          );
    return {
      placements,
      clearance: {
        x,
        y,
        requiredX,
        requiredY,
        withinBoard,
        ready,
      },
    };
  }

  private commitTear(plan: TearPlan) {
    const preview = this.preview;
    if (!preview) return;
    const source = preview.source;
    const recipe = source.recipe!;
    const heldGroups = new Set(
      [...this.contacts.values()]
        .filter(
          (contact) =>
            contact.entityId === source.id &&
            contact.group !== null &&
            !contact.tileGrip,
        )
        .map((contact) => contact.group!),
    );
    const made = recipe.parts.map((part, index) => {
      const { center } = plan.placements[index];
      const groupBody =
        index === preview.partIndex ? preview.partBody : preview.restBody;
      const held = heldGroups.has(index);
      return this.createObject(
        part.char,
        center,
        true,
        DEFAULT_GLYPH_SCALE,
        DEFAULT_GLYPH_SCALE,
        held ? { x: 0, y: 0 } : groupBody.meanVelocity(),
        true,
      );
    });
    const sourceCenter = source.body.pose();
    for (const [index, object] of made.entries()) {
      // The hand now controls this piece. A launch impulse fights the held
      // attachment and makes its new tile orbit around the pinned strokes.
      if (heldGroups.has(index)) continue;
      const vector = object.body.pose();
      const dx = vector.x - sourceCenter.x,
        dy = vector.y - sourceCenter.y;
      const distance = Math.hypot(dx, dy) || 1;
      object.body.addForce((dx / distance) * 115, (dy / distance) * 115, STEP);
    }
    this.objects = [
      ...this.objects.filter((object) => object !== source),
      ...made,
    ];
    for (const [pointerId, contact] of this.contacts) {
      if (contact.entityId !== source.id || contact.group === null) continue;
      const group = contact.group;
      const object = made[group];
      contact.entityId = object.id;
      contact.group = null;
      contact.body.release(pointerId);
      contact.body = object.body;
      contact.binding = object.body.start(contact.target, pointerId);
      if (!contact.tileGrip) object.tileFollowsInkUntilRelease = true;
    }
    for (const index of heldGroups) {
      const object = made[index];
      const heldTargets = [...this.contacts.values()].filter(
        (contact) => contact.entityId === object.id && !contact.tileGrip,
      );
      if (!heldTargets.length) continue;
      const pointerCenter = heldTargets.reduce(
        (center, contact) => ({
          x: center.x + contact.target.x / heldTargets.length,
          y: center.y + contact.target.y / heldTargets.length,
        }),
        { x: 0, y: 0 },
      );
      const tileCenter = object.surfaceBody.pose();
      object.tileFollowOffset = {
        x: tileCenter.x - pointerCenter.x,
        y: tileCenter.y - pointerCenter.y,
      };
    }
    this.preview = null;
    this.events.push({
      type: "tear",
      character: recipe.parts[preview.partIndex].char,
    });
    this.setPhase(
      "loose",
      `Free pieces: ${recipe.parts[0].char} + ${recipe.parts[1].char}. Overlap the tiles or hold one piece's ink over the other tile to recombine.`,
    );
  }

  private findMagnet(): MagnetMatch | null {
    let best: MagnetMatch | null = null;
    for (let i = 0; i < this.objects.length; i++) {
      const a = this.objects[i];
      if (!a.free) continue;
      for (let j = i + 1; j < this.objects.length; j++) {
        const b = this.objects[j];
        if (!b.free) continue;
        const tileOverlap = this.tileOverlap(a.surfaceBody, b.surfaceBody);
        for (const recipe of this.recipes) {
          const first = recipe.parts[0].char,
            second = recipe.parts[1].char;
          let partA: PartAsset, partB: PartAsset;
          if (a.char === first && b.char === second) {
            [partA, partB] = recipe.parts;
          } else if (a.char === second && b.char === first) {
            [partA, partB] = [recipe.parts[1], recipe.parts[0]];
          } else continue;
          const inkOverlap = tileOverlap
            ? null
            : (this.heldInkOnFace(a, b) ?? this.heldInkOnFace(b, a));
          if (!tileOverlap && !inkOverlap) continue;
          const overlap = tileOverlap ?? inkOverlap!;
          const baseLayoutA = partA.layout,
            baseLayoutB = partB.layout,
            // Choose the largest scale supported by both pieces, without
            // letting independently full-size pieces inflate their parent.
            parentScaleX = DEFAULT_GLYPH_SCALE,
            parentScaleY = DEFAULT_GLYPH_SCALE,
            layoutA = {
              ...baseLayoutA,
              parentOffset: {
                x: baseLayoutA.parentOffset.x * parentScaleX,
                y: baseLayoutA.parentOffset.y * parentScaleY,
              },
            },
            layoutB = {
              ...baseLayoutB,
              parentOffset: {
                x: baseLayoutB.parentOffset.x * parentScaleX,
                y: baseLayoutB.parentOffset.y * parentScaleY,
              },
            },
            anchorA = inkCenter(a.ink, a.body),
            anchorB = inkCenter(b.ink, b.body),
            errorX =
              anchorB.x -
              anchorA.x -
              (layoutB.parentOffset.x - layoutA.parentOffset.x),
            errorY =
              anchorB.y -
              anchorA.y -
              (layoutB.parentOffset.y - layoutA.parentOffset.y),
            distance = Math.hypot(errorX, errorY);
          const expectedX = layoutB.parentOffset.x - layoutA.parentOffset.x,
            expectedY = layoutB.parentOffset.y - layoutA.parentOffset.y,
            actualX = anchorB.x - anchorA.x,
            actualY = anchorB.y - anchorA.y,
            reversedX =
              Math.abs(expectedX) > TILE_CLEARANCE &&
              actualX * expectedX < -TILE_CLEARANCE * Math.abs(expectedX),
            reversedY =
              Math.abs(expectedY) > TILE_CLEARANCE &&
              actualY * expectedY < -TILE_CLEARANCE * Math.abs(expectedY);
          if (reversedX || reversedY) continue;
          if (!best || distance < best.distance)
            best = {
              recipe,
              a,
              b,
              contactKind: tileOverlap ? "tiles" : "ink",
              layoutA,
              layoutB,
              anchorA,
              anchorB,
              errorX,
              errorY,
              distance,
              overlapX: overlap.x,
              overlapY: overlap.y,
              overlapDepth: overlap.depth,
              parentScaleX,
              parentScaleY,
            };
        }
      }
    }
    return best;
  }

  private magnetStrength(match: MagnetMatch) {
    const alignment =
      MAGNET_FAR_ALIGNMENT_STRENGTH +
      (1 - MAGNET_FAR_ALIGNMENT_STRENGTH) *
        clamp(1 - match.distance / MAGNET_FULL_ALIGNMENT_DISTANCE, 0, 1);
    const overlap = clamp(
      match.overlapDepth / MAGNET_FULL_STRENGTH_OVERLAP,
      0,
      1,
    );
    return alignment * overlap;
  }

  private applyTileRepulsion(dt: number, magneticPair: MagnetMatch | null) {
    if (!this.tileRepulsion) return;
    const directlyHeld = new Set(
      [...this.contacts.values()].map((contact) => contact.entityId),
    );
    for (let i = 0; i < this.objects.length; i++)
      for (let j = i + 1; j < this.objects.length; j++) {
        const a = this.objects[i];
        const b = this.objects[j];
        const positionA = a.surfaceBody.pose();
        const positionB = b.surfaceBody.pose();
        const footprintA = this.tileFootprint(a.surfaceBody);
        const footprintB = this.tileFootprint(b.surfaceBody);
        const gapX =
          (footprintA.width + footprintB.width) / 2 -
          Math.abs(positionB.x - positionA.x);
        const gapY =
          (footprintA.height + footprintB.height) / 2 -
          Math.abs(positionB.y - positionA.y);
        const penetration =
          Math.min(gapX, gapY) + TILE_REPULSION_RANGE;
        if (penetration <= 0) continue;

        let dx = positionB.x - positionA.x;
        let dy = positionB.y - positionA.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) {
          dx = a.id < b.id ? 1 : -1;
          dy = 0;
          distance = 1;
        }
        const progress = clamp(penetration / TILE_REPULSION_RANGE, 0, 1);
        const compatible =
          magneticPair &&
          ((magneticPair.a === a && magneticPair.b === b) ||
            (magneticPair.a === b && magneticPair.b === a));
        const force =
          TILE_REPULSION_FORCE *
          progress ** 2 *
          (compatible ? 0.15 : 1);
        const direction = { x: dx / distance, y: dy / distance };
        const movableA = !a.surfaceBody.fixed && !directlyHeld.has(a.id);
        const movableB = !b.surfaceBody.fixed && !directlyHeld.has(b.id);
        if (movableA && movableB) {
          for (const body of [a.body, a.surfaceBody])
            body.addForce(
              -direction.x * force * 0.5,
              -direction.y * force * 0.5,
              dt,
            );
          for (const body of [b.body, b.surfaceBody])
            body.addForce(
              direction.x * force * 0.5,
              direction.y * force * 0.5,
              dt,
            );
        } else if (movableA) {
          for (const body of [a.body, a.surfaceBody])
            body.addForce(-direction.x * force, -direction.y * force, dt);
        } else if (movableB) {
          for (const body of [b.body, b.surfaceBody])
            body.addForce(direction.x * force, direction.y * force, dt);
        }
      }
  }

  private magnetVisual(match: MagnetMatch) {
    const centerX =
        (match.anchorA.x -
          match.layoutA.parentOffset.x +
          match.anchorB.x -
          match.layoutB.parentOffset.x) /
        2,
      centerY =
        (match.anchorA.y -
          match.layoutA.parentOffset.y +
          match.anchorB.y -
          match.layoutB.parentOffset.y) /
        2;
    return {
      from: match.anchorA,
      to: match.anchorB,
      contact: match.contactKind,
      targetFrom: {
        x: centerX + match.layoutA.parentOffset.x,
        y: centerY + match.layoutA.parentOffset.y,
      },
      targetTo: {
        x: centerX + match.layoutB.parentOffset.x,
        y: centerY + match.layoutB.parentOffset.y,
      },
      distance: match.distance,
      overlap: { x: match.overlapX, y: match.overlapY },
      strength: this.magnetStrength(match),
    };
  }

  private compose(match: MagnetMatch) {
    if (!this.objects.includes(match.a) || !this.objects.includes(match.b))
      return;
    const center = {
      x:
        (match.anchorA.x -
          match.layoutA.parentOffset.x +
          match.anchorB.x -
          match.layoutB.parentOffset.x) /
        2,
      y:
        (match.anchorA.y -
          match.layoutA.parentOffset.y +
          match.anchorB.y -
          match.layoutB.parentOffset.y) /
        2,
    };
    const velocityA = match.a.body.meanVelocity(),
      velocityB = match.b.body.meanVelocity();
    const remainsFree = this.objects.some(
      (object) => object !== match.a && object !== match.b && object.free,
    );
    const composed = this.createObject(
      match.recipe.char,
      center,
      remainsFree,
      match.parentScaleX,
      match.parentScaleY,
      {
        x: (velocityA.x + velocityB.x) / 2,
        y: (velocityA.y + velocityB.y) / 2,
      },
    );
    this.objects = [
      ...this.objects.filter(
        (object) => object !== match.a && object !== match.b,
      ),
      composed,
    ];
    this.events.push({ type: "compose", character: composed.char });
    for (const [pointerId, contact] of this.contacts) {
      if (contact.entityId !== match.a.id && contact.entityId !== match.b.id)
        continue;
      if (contact.tileGrip) contact.surfaceBody.releaseWhole(pointerId);
      else contact.body.release(pointerId);
      contact.entityId = composed.id;
      contact.group = null;
      contact.body = composed.body;
      contact.surfaceBody = composed.surfaceBody;
      contact.binding = contact.tileGrip
        ? composed.surfaceBody.startWholeDrag(contact.target, pointerId)
        : composed.body.start(contact.target, pointerId);
      if (contact.tileGrip) composed.body.setVelocity(0, 0);
    }
    const stillLoose = this.objects.length > 1;
    this.setPhase(
      stillLoose ? "loose" : "whole",
      stillLoose
        ? `Snapped into ${match.recipe.char}. Any remaining character can still be pulled apart.`
        : `Snapped into ${match.recipe.char}. Pull a component to take it apart again.`,
    );
  }

  private applyMagnet(match: MagnetMatch, dt: number) {
    const strength = this.magnetStrength(match);
    if (!strength) return;
    const x = match.errorX / (match.distance || 1),
      y = match.errorY / (match.distance || 1),
      heldA = [...this.contacts.values()].some(
        (contact) => contact.entityId === match.a.id,
      ),
      heldB = [...this.contacts.values()].some(
        (contact) => contact.entityId === match.b.id,
      );
    const tug = (object: SceneObject, direction: Point, held: boolean) => {
      if (!held)
        object.body.addForce(
          direction.x * 90 * strength,
          direction.y * 90 * strength,
          dt,
        );
      if (object.body.reduced) return;
      const edge = facingBinding(object.ink, object.body, direction);
      const amount = (held ? 0.38 : 0.13) * strength;
      object.body.apply(edge, direction.x * amount, direction.y * amount, dt);
    };
    tug(match.a, { x, y }, heldA);
    tug(match.b, { x: -x, y: -y }, heldB);
  }

  step(dt = STEP): boolean {
    if (this.preview) {
      this.preview.restBody.step(dt);
      this.preview.partBody.step(dt);
      const stretched = coupleComponents(
        this.preview.restBody,
        this.preview.partBody,
        this.preview.tethers,
        dt,
      );
      if (stretched) {
        const plan = this.planTear(this.preview);
        if (plan.clearance.ready) {
          this.commitTear(plan);
          return true;
        }
        this.message = plan.clearance.withinBoard
          ? "Keep pulling until the tile faces have room."
          : "Guide both pieces back inside the board before they separate.";
      } else {
        const part =
          this.preview.source.recipe!.parts[this.preview.partIndex].char;
        this.message = `Pull ${part} away. The rest resists and gives a little.`;
      }
      return false;
    }
    const magneticPair = this.findMagnet();
    this.applyTileRepulsion(dt, magneticPair);
    for (const object of this.objects) {
      const surfaceBefore = object.surfaceBody.pose();
      object.surfaceBody.step(dt);
      const surfaceAfter = object.surfaceBody.pose();
      object.body.translate(
        surfaceAfter.x - surfaceBefore.x,
        surfaceAfter.y - surfaceBefore.y,
      );
      const held = [...this.contacts.values()].some(
        (contact) => contact.entityId === object.id,
      );
      const heldInk = [...this.contacts.values()].some(
        (contact) => contact.entityId === object.id && !contact.tileGrip,
      );
      if (object.tileFollowsInkUntilRelease && !heldInk) {
        object.tileFollowsInkUntilRelease = false;
        object.tileFollowOffset = null;
      }
      const aligning =
        magneticPair?.a.id === object.id || magneticPair?.b.id === object.id;
      if (this.visualStyle !== "flat" && !held && !aligning)
        object.body.restorePose(surfaceAfter, dt);
      object.body.step(dt);
      if (object.tileFollowsInkUntilRelease && heldInk) {
        const heldTargets = [...this.contacts.values()].filter(
          (contact) => contact.entityId === object.id && !contact.tileGrip,
        );
        const pointerCenter = heldTargets.reduce(
          (center, contact) => ({
            x: center.x + contact.target.x / heldTargets.length,
            y: center.y + contact.target.y / heldTargets.length,
          }),
          { x: 0, y: 0 },
        );
        const tilePose = object.surfaceBody.pose();
        const tileSize = this.tileDimensions(object.surfaceBody);
        const targetX = clamp(
          pointerCenter.x + (object.tileFollowOffset?.x ?? 0),
          tileSize.width / 2,
          this.width - tileSize.width / 2,
        );
        const targetY = clamp(
          pointerCenter.y + (object.tileFollowOffset?.y ?? 0),
          tileSize.height / 2,
          this.height - tileSize.height / 2,
        );
        const dx = targetX - tilePose.x;
        const dy = targetY - tilePose.y;
        object.surfaceBody.translate(dx, dy);
        object.body.translate(dx, dy);
      }
    }
    const magnet = this.findMagnet();
    if (!magnet) return false;
    if (magnet.distance <= this.snapRadius) {
      this.compose(magnet);
      return true;
    }
    this.applyMagnet(magnet, dt);
    return false;
  }

  advance(ms: number) {
    if (!Number.isFinite(ms) || ms < 0) return false;
    this.elapsed += Math.min(ms, 10000) / 1000;
    let changed = false;
    while (this.elapsed >= STEP) {
      changed = this.step(STEP) || changed;
      this.elapsed -= STEP;
    }
    return changed;
  }

  layers(): InkLayer[] {
    const preview = this.preview;
    return this.objects.flatMap((object) => {
      if (!preview || object !== preview.source)
        return [
          {
            ink: object.ink,
            body: object.body,
            surfaceBody: object.surfaceBody,
            character: object.char,
          },
        ];

      const restIndex = 1 - preview.partIndex;
      const parts = object.recipe!.parts;
      return [
        {
          ink: preview.restInk,
          body: preview.restBody,
          surfaceBody: object.surfaceBody,
          character: parts[restIndex].char,
        },
        {
          ink: preview.partInk,
          body: preview.partBody,
          surfaceBody: object.surfaceBody,
          character: parts[preview.partIndex].char,
        },
      ];
    });
  }

  connections() {
    return this.preview
      ? {
          tethers: this.preview.tethers,
          parent: this.preview.restBody,
          part: this.preview.partBody,
        }
      : null;
  }

  magnet() {
    const match = this.findMagnet();
    return match ? this.magnetVisual(match) : null;
  }

  get loadedGlyphCount() {
    return Object.keys(this.assets.glyphs).length;
  }

  snapshot() {
    const active = this.preview?.restBody ?? this.objects[0]?.body;
    const magnetMatch = this.findMagnet();
    const magnet = magnetMatch ? this.magnetVisual(magnetMatch) : null;
    const tearPlan = this.preview ? this.planTear(this.preview) : null;
    const componentPoints: Record<string, Point> = {};
    const componentGrabPoints: Record<string, Point[]> = {};
    for (const object of this.objects) {
      if (!object.recipe) continue;
      object.recipe.parts.forEach((part) => {
        const partInk = skinStrokes(part.embeddedStrokes, object.body);
        componentPoints[part.char] = inkCenter(partInk, object.body);
        componentGrabPoints[part.char] = partInk.map((stroke) =>
          object.body.at(stroke[Math.floor(stroke.length / 2)]),
        );
      });
    }
    if (this.preview) {
      const source = this.preview.source;
      const selected = source.recipe!.parts[this.preview.partIndex].char;
      const rest = source.recipe!.parts[1 - this.preview.partIndex].char;
      componentPoints[selected] = inkCenter(
        this.preview.partInk,
        this.preview.partBody,
      );
      componentPoints[rest] = inkCenter(
        this.preview.restInk,
        this.preview.restBody,
      );
      componentGrabPoints[selected] = this.preview.partInk.map((stroke) =>
        this.preview!.partBody.at(stroke[Math.floor(stroke.length / 2)]),
      );
      componentGrabPoints[rest] = this.preview.restInk.map((stroke) =>
        this.preview!.restBody.at(stroke[Math.floor(stroke.length / 2)]),
      );
    }
    const grab = [...this.contacts.values()][0];
    return {
      mode: "wobble-playground",
      character: this.selectedCharacter,
      ready: this.isReady,
      loadedGlyphCount: this.loadedGlyphCount,
      loadedRecipeCount: this.recipeByChar.size,
      loadedRecipeCharacters: [...this.recipeByChar.keys()],
      coordinates: "CSS pixels from canvas top-left; x right, y down",
      physicsMode: this.physicsMode,
      visualStyle: this.visualStyle,
      tileRepulsion: this.tileRepulsion,
      boardPreset: this.boardPreset,
      phase: this.phase,
      message: this.message,
      dragging: this.contacts.size > 0,
      contactCount: this.contacts.size,
      activeContacts: [...this.contacts.entries()].map(
        ([pointerId, contact]) => ({
          pointerId,
          character:
            this.objects.find((object) => object.id === contact.entityId)
              ?.char ??
            this.preview?.source.char ??
            null,
          component:
            contact.group === null
              ? null
              : (this.preview?.source.recipe?.parts[contact.group].char ??
                null),
          interaction: contact.tileGrip
            ? "tile"
            : contact.group === null
              ? "ink"
              : "component",
          target: contact.target,
          point: contact.tileGrip
            ? contact.surfaceBody.at(contact.binding)
            : contact.body.at(contact.binding),
        }),
      ),
      characters: this.objects.map((object) => ({
        id: object.id,
        char: object.char,
        free: object.free,
        decomposable: !!object.recipe,
        center: object.body.pose(),
        tile: {
          center: object.surfaceBody.pose(),
          ...this.tileDimensions(object.surfaceBody),
        },
        inkCenter: inkCenter(object.ink, object.body),
        scale: { x: object.body.scaleX, y: object.body.scaleY },
        grabPoints: object.ink.flatMap((stroke) =>
          stroke.length
            ? [object.body.at(stroke[Math.floor(stroke.length / 2)])]
            : [],
        ),
      })),
      renderedInkLayers: this.layers().map((layer) => layer.character),
      tearing: this.preview
        ? {
            parent: this.preview.source.char,
            part: this.preview.source.recipe!.parts[this.preview.partIndex]
              .char,
            tetherCount: this.preview.tethers.length,
            readyForTiles: tearPlan?.clearance.ready ?? false,
            tileClearance: tearPlan?.clearance ?? null,
          }
        : null,
      magnet: magnet
        ? {
            active: true,
            parent: magnetMatch?.recipe.char ?? null,
            distance: magnet.distance,
            strength: magnet.strength,
            contact: magnet.contact,
            contactOverlap: magnet.overlap,
            tileOverlap: magnet.contact === "tiles" ? magnet.overlap : null,
            parentScale: {
              x: magnetMatch?.parentScaleX ?? 1,
              y: magnetMatch?.parentScaleY ?? 1,
            },
            from: magnet.from,
            to: magnet.to,
            targetFrom: magnet.targetFrom,
            targetTo: magnet.targetTo,
          }
        : { active: false },
      componentPoints,
      componentGrabPoints,
      softness: this.softness,
      reducedMotion: this.reduced,
      pose: active?.pose() ?? null,
      grab: grab ? grab.body.at(grab.binding) : null,
      grabPoints: active
        ? [
            active.bind(0.34, 0.28),
            active.bind(0.58, 0.27),
            active.bind(0.5, 0.72),
          ].map((binding) => active.at(binding))
        : [],
      nodes: active?.nodes.map((node) => ({ x: node.x, y: node.y })) ?? [],
    };
  }
}

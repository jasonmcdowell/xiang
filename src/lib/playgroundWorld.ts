import { STEP, WobbleBody, type Point } from "./wobble";
import { componentLayout, type ComponentLayout } from "./wobbleComponents";
import {
  facingBinding,
  hitInk,
  hitTileFace,
  inkCenter,
  measureGlyph,
  prepareSilkSupportSurfaces,
  projectInkPoint,
  skinStrokes,
  type GlyphGeometry,
  type Ink,
  type InkLayer,
  type VisualStyle,
} from "./wobbleDrawing";

export type PhysicsMode = "fixed" | "weighted";
export type ArrangeMode = "one-by-one" | "all-at-once" | "by-component";
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
export type PlaygroundBoardPreset = "starters" | "single" | "custom" | "cells";

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
  snapAfterRelease: boolean;
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
type TileMove = {
  object: SceneObject;
  fromInk: ReturnType<WobbleBody["pose"]>;
  fromTile: ReturnType<WobbleBody["pose"]>;
  target: Point;
  delay: number;
  duration: number;
  arc?: number;
  targetAngle?: number;
};

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const TILE_FACE_INSET = 38;
const TILE_FACE_SIZE = 156;
const TILE_CLEARANCE = 10;
const GRID_GAP = 30;
const GRID_MARGIN = 12;
const DEFAULT_GLYPH_SCALE = 0.36;
const TILE_OVERLAP_EPSILON = 0.01;
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
  private frontTileId: number | null = null;
  private customStarts: StartingTile[] | null = null;
  private preview: TearPreview | null = null;
  private contacts = new Map<number, Contact>();
  private tileAnimation: { elapsed: number; moves: TileMove[] } | null = null;
  private events: PlaygroundWorldEvent[] = [];
  private nextId = 1;
  private elapsed = 0;
  private cellBoard: { cells: number; capacity: number } | null = null;
  private tileFaceSize = TILE_FACE_SIZE;
  private tileFaceInset = TILE_FACE_INSET;
  private tileClearance = TILE_CLEARANCE;
  private readonly snapRadius = 12;
  phase: "whole" | "stretching" | "loose" = "whole";
  message = "Pull a component outward. Stretch its seam to tear it free.";
  selectedCharacter = "想";
  boardPreset: PlaygroundBoardPreset = "starters";
  physicsMode: PhysicsMode = "weighted";
  visualStyle: VisualStyle = "raised";
  tileRepulsion = true;
  softness = 0.55;
  reduced = false;
  snapToGrid = false;

  constructor(
    private width: number,
    private height: number,
    assets: PlaygroundAssets,
  ) {
    this.assets = assets;
    this.compileAssets();
    this.resetStarters();
  }

  get cellCapacity() {
    return this.cellBoard?.capacity ?? null;
  }

  private get tileSizeRatio() {
    return this.tileFaceSize / TILE_FACE_SIZE;
  }

  private get glyphScale() {
    return DEFAULT_GLYPH_SCALE * this.tileSizeRatio;
  }

  setCellBoard(cells: 3 | 4 | 5 | 6) {
    this.cellBoard = { cells, capacity: cells * cells };
    const squareSize = Math.min(this.width, this.height);
    const cellSize = (squareSize * 0.88) / cells;
    this.tileFaceSize = Math.min(TILE_FACE_SIZE, cellSize * 0.86);
    this.tileFaceInset = TILE_FACE_INSET * (this.tileFaceSize / TILE_FACE_SIZE);
    this.tileClearance = TILE_CLEARANCE * (this.tileFaceSize / TILE_FACE_SIZE);
    this.snapToGrid = true;
  }

  startCellBoard(char: string) {
    if (!this.cellBoard) throw new Error("Choose a cell board first.");
    if (!this.assets.glyphs[char])
      throw new Error(`Missing playground glyph for ${char}.`);
    this.cancelAll();
    this.events.length = 0;
    this.boardPreset = "cells";
    this.customStarts = null;
    this.selectedCharacter = char;
    this.objects = [this.createObject(char, this.gridCenters(1)[0], false)];
    this.preview = null;
    this.setPhase(
      "whole",
      `${char} is ready. Discover new characters before the board fills.`,
    );
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

  convertCharacters(characterMap: Record<string, string>) {
    if (this.isManipulating || this.isAnimatingTiles) return false;
    const convertWhenLoaded = (character: string) => {
      const candidate = characterMap[character] ?? character;
      return this.assets.glyphs[candidate] ? candidate : character;
    };
    for (const object of this.objects) {
      const character = convertWhenLoaded(object.char);
      if (character === object.char) continue;
      object.char = character;
      object.ink = skinStrokes(this.assets.glyphs[character], object.body);
      object.recipe = this.recipeByChar.get(character) ?? null;
    }
    this.selectedCharacter = convertWhenLoaded(this.selectedCharacter);
    if (this.customStarts)
      this.customStarts = this.customStarts.map((start) => ({
        ...start,
        char: convertWhenLoaded(start.char),
      }));
    this.events.length = 0;
    return true;
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

  get isAnimatingTiles() {
    return this.tileAnimation !== null;
  }

  get isManipulating() {
    return this.contacts.size > 0 || !!this.preview;
  }

  private allBodies() {
    const bodies = this.objects.flatMap((object) => [
      object.body,
      object.surfaceBody,
    ]);
    if (this.preview) bodies.push(this.preview.restBody, this.preview.partBody);
    return bodies;
  }

  private effectiveSoftness() {
    return this.visualStyle === "silk"
      ? Math.max(this.softness, 0.72)
      : this.softness;
  }

  private setBodyMode(body: WobbleBody, free: boolean) {
    body.softness = this.effectiveSoftness();
    body.reduced = this.reduced;
    body.grabStrength = free ? 1.25 : this.physicsMode === "fixed" ? 0.8 : 0.42;
    body.setFixed(!free && this.physicsMode === "fixed");
  }

  private createObject(
    char: string,
    center: Point,
    free: boolean,
    scaleX?: number,
    scaleY?: number,
    velocity: Point = { x: 0, y: 0 },
    componentPiece = false,
  ): SceneObject {
    const strokes = this.assets.glyphs[char];
    if (!strokes) throw new Error(`Missing playground glyph for ${char}.`);
    const actualScaleX = scaleX ?? this.glyphScale;
    const actualScaleY = scaleY ?? this.glyphScale;
    const body = new WobbleBody(
      this.width,
      this.height,
      actualScaleX,
      actualScaleY,
    );
    const surfaceSize = Math.min(390, this.width * 0.8, this.height * 0.75);
    const tileScale = (this.tileFaceSize - this.tileFaceInset) / surfaceSize;
    const surfaceBody = new WobbleBody(
      this.width,
      this.height,
      tileScale,
      tileScale,
    );
    surfaceBody.frameInset = this.tileFaceInset;
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
      snapAfterRelease: false,
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
      this.preview.restBody.setVelocity(0, 0);
      this.preview.restBody.setFixed(true);
    }
  }

  setVisualStyle(style: VisualStyle) {
    this.visualStyle = style;
    for (const body of this.allBodies())
      body.softness = this.effectiveSoftness();
  }

  setTileRepulsion(enabled: boolean) {
    this.tileRepulsion = enabled;
  }

  setSnapToGrid(enabled: boolean) {
    this.snapToGrid = !!this.cellBoard || enabled;
  }

  compatibleTileIds(id: number | null) {
    if (id === null) return [];
    const selected = this.objects.find((object) => object.id === id);
    if (!selected?.free) return [];
    const index = this.assets.compositionParents ?? {};
    return this.objects
      .filter((object) => {
        if (object.id === selected.id || !object.free) return false;
        return (
          (index[compositionKey(selected.char, object.char)] ?? []).length > 0
        );
      })
      .map((object) => object.id);
  }

  arrangeTiles(mode: ArrangeMode) {
    if (this.contacts.size || this.preview || this.tileAnimation) return false;
    if (!this.objects.length) return false;
    const ordered =
      mode === "by-component"
        ? this.orderBySharedComponents()
        : [...this.objects];
    const slots = this.gridCenters(ordered.length);
    const duration = mode === "all-at-once" ? 0.58 : 0.26;
    const delay = mode === "one-by-one" ? duration + 0.04 : 0.09;
    const moves = ordered.map((object, index) => ({
      object,
      fromInk: object.body.pose(),
      fromTile: object.surfaceBody.pose(),
      target: slots[index],
      delay: mode === "all-at-once" ? 0 : index * delay,
      duration,
    }));
    return this.startTileAnimation(moves);
  }

  blastTiles(random: () => number = Math.random) {
    if (this.contacts.size || this.preview || this.tileAnimation) return false;
    if (!this.objects.length) return false;
    const half = this.tileFaceSize / 2 + 24;
    const minX = Math.min(half, this.width / 2);
    const maxX = Math.max(this.width - half, this.width / 2);
    const minY = Math.min(half, this.height / 2);
    const maxY = Math.max(this.height - half, this.height / 2);
    const moves = this.objects.map((object) => ({
      object,
      fromInk: object.body.pose(),
      fromTile: object.surfaceBody.pose(),
      target: {
        x: minX + random() * (maxX - minX),
        y: minY + random() * (maxY - minY),
      },
      delay: random() * 0.16,
      duration: 0.42 + random() * 0.24,
      targetAngle: (random() - 0.5) * 0.16,
      arc: 8 + random() * 12,
    }));
    return this.startTileAnimation(moves);
  }

  shuffleTiles(random: () => number = Math.random) {
    if (this.contacts.size || this.preview || this.tileAnimation) return false;
    if (this.objects.length < 2) return false;
    const slots = this.gridCenters(
      this.cellBoard?.capacity ?? this.objects.length,
    );
    for (let index = slots.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [slots[index], slots[other]] = [slots[other], slots[index]];
    }
    if (
      this.objects.every((object, index) => {
        const pose = object.surfaceBody.pose();
        return Math.hypot(pose.x - slots[index].x, pose.y - slots[index].y) < 1;
      })
    )
      slots.push(slots.shift()!);
    const moves = this.objects.map((object, index) => ({
      object,
      fromInk: object.body.pose(),
      fromTile: object.surfaceBody.pose(),
      target: slots[index],
      delay: index * 0.045,
      duration: 0.54 + random() * 0.08,
      targetAngle: (random() - 0.5) * 0.1,
      arc: 12 + random() * 10,
    }));
    return this.startTileAnimation(moves);
  }

  private startTileAnimation(moves: TileMove[]) {
    if (
      moves.every((move) => {
        const targetAngle = move.targetAngle ?? 0;
        const ink = move.fromInk;
        const tile = move.fromTile;
        return (
          Math.hypot(ink.x - move.target.x, ink.y - move.target.y) < 0.1 &&
          Math.hypot(tile.x - move.target.x, tile.y - move.target.y) < 0.1 &&
          Math.abs(ink.angle - targetAngle) < 0.001 &&
          Math.abs(tile.angle - targetAngle) < 0.001
        );
      })
    )
      return true;
    if (this.reduced) {
      for (const move of moves) this.applyTilePose(move, 1);
      return true;
    }
    this.tileAnimation = { elapsed: 0, moves };
    return true;
  }

  private orderBySharedComponents() {
    const remaining = [...this.objects];
    const partsOf = (object: SceneObject) =>
      new Set(object.recipe?.parts.map((part) => part.char) ?? []);
    const sharedCount = (a: SceneObject, b: SceneObject) => {
      const first = partsOf(a);
      return [...partsOf(b)].filter((part) => first.has(part)).length;
    };
    const componentDegree = (object: SceneObject) =>
      remaining.reduce(
        (sum, candidate) =>
          sum + (candidate === object ? 0 : sharedCount(object, candidate)),
        0,
      );
    const ordered: SceneObject[] = [];
    let previous: SceneObject | null = null;
    const compareCharacters = (a: SceneObject, b: SceneObject) =>
      a.char < b.char ? -1 : a.char > b.char ? 1 : a.id - b.id;
    while (remaining.length) {
      let next: SceneObject;
      if (previous) {
        const candidates = remaining
          .map((object) => ({ object, shared: sharedCount(previous!, object) }))
          .sort(
            (a, b) =>
              b.shared - a.shared || compareCharacters(a.object, b.object),
          );
        if (candidates[0]?.shared) next = candidates[0].object;
        else
          next = [...remaining].sort(
            (a, b) =>
              componentDegree(b) - componentDegree(a) ||
              compareCharacters(a, b),
          )[0];
      } else
        next = [...remaining].sort(
          (a, b) =>
            componentDegree(b) - componentDegree(a) || compareCharacters(a, b),
        )[0];
      remaining.splice(remaining.indexOf(next), 1);
      ordered.push(next);
      previous = next;
    }
    return ordered;
  }

  private gridCenters(count: number): Point[] {
    if (!count) return [];
    if (this.cellBoard) {
      const board = this.cellBoard;
      const square = Math.min(this.width, this.height);
      const origin = {
        x: (this.width - square) / 2,
        y: (this.height - square) / 2,
      };
      const cell = (square * 0.88) / board.cells;
      const startX = origin.x + square * 0.06;
      const startY = origin.y + square * 0.06;
      return Array.from(
        { length: Math.min(count, board.capacity) },
        (_, index) => ({
          x: startX + cell * ((index % board.cells) + 0.5),
          y: startY + cell * (Math.floor(index / board.cells) + 0.5),
        }),
      );
    }
    const maxColumns = Math.max(
      1,
      Math.floor(
        (this.width - GRID_MARGIN * 2 + GRID_GAP * this.tileSizeRatio) /
          (this.tileFaceSize + GRID_GAP * this.tileSizeRatio),
      ),
    );
    const columns = Math.min(maxColumns, count);
    const rows = Math.ceil(count / columns);
    const availableX = Math.max(
      0,
      this.width - this.tileFaceSize - GRID_MARGIN * 2,
    );
    const availableY = Math.max(
      0,
      this.height - this.tileFaceSize - GRID_MARGIN * 2,
    );
    const pitchX =
      columns > 1
        ? Math.min(
            this.tileFaceSize + GRID_GAP * this.tileSizeRatio,
            availableX / (columns - 1),
          )
        : 0;
    const pitchY =
      rows > 1
        ? Math.min(
            this.tileFaceSize + GRID_GAP * this.tileSizeRatio,
            availableY / (rows - 1),
          )
        : 0;
    return Array.from({ length: count }, (_, index) => ({
      x: GRID_MARGIN + this.tileFaceSize / 2 + (index % columns) * pitchX,
      y:
        GRID_MARGIN +
        this.tileFaceSize / 2 +
        Math.floor(index / columns) * pitchY,
    }));
  }

  private applyTilePose(move: TileMove, progress: number) {
    const eased = progress * progress * (3 - 2 * progress);
    const fromY = move.fromTile.y;
    const topClearance =
      Math.min(fromY, move.target.y) - this.tileFaceSize / 2 - 12;
    const bottomClearance =
      this.height - this.tileFaceSize / 2 - 12 - Math.max(fromY, move.target.y);
    const direction = topClearance >= bottomClearance ? -1 : 1;
    const arc =
      direction *
      Math.sin(progress * Math.PI) *
      Math.min(
        move.arc ?? 0,
        Math.max(0, Math.max(topClearance, bottomClearance)),
      );
    const poseAt = (from: ReturnType<WobbleBody["pose"]>) => ({
      x: from.x + (move.target.x - from.x) * eased,
      y: from.y + (move.target.y - from.y) * eased + arc,
      angle: from.angle * (1 - eased) + (move.targetAngle ?? 0) * eased,
    });
    move.object.body.setPose(poseAt(move.fromInk));
    move.object.surfaceBody.setPose(poseAt(move.fromTile));
  }

  private advanceTileAnimation(dt: number) {
    const animation = this.tileAnimation;
    if (!animation) return false;
    animation.elapsed += dt;
    let complete = true;
    for (const move of animation.moves) {
      const progress = clamp(
        (animation.elapsed - move.delay) / move.duration,
        0,
        1,
      );
      this.applyTilePose(move, progress);
      if (progress < 1) complete = false;
    }
    if (!complete) return false;
    this.tileAnimation = null;
    return true;
  }

  private snapTileToGrid(id: number) {
    const object = this.objects.find((candidate) => candidate.id === id);
    if (!object) return;
    const slots = this.gridCenters(
      this.cellBoard?.capacity ?? this.objects.length + 1,
    );
    const face = this.tileDimensions(object.surfaceBody);
    const open = slots.filter((center) =>
      this.objects
        .filter((candidate) => candidate !== object)
        .every((candidate) =>
          this.facesClear(
            center,
            face,
            candidate.surfaceBody.pose(),
            this.tileFootprint(candidate.surfaceBody),
          ),
        ),
    );
    const from = object.surfaceBody.pose();
    const candidates = open.length ? open : slots;
    const target = candidates.reduce((best, candidate) =>
      Math.hypot(candidate.x - from.x, candidate.y - from.y) <
      Math.hypot(best.x - from.x, best.y - from.y)
        ? candidate
        : best,
    );
    const move: TileMove = {
      object,
      fromInk: object.body.pose(),
      fromTile: from,
      target,
      delay: 0,
      duration: this.reduced ? 0.001 : 0.34,
    };
    this.tileAnimation = { elapsed: 0, moves: [move] };
  }

  private placeOnOpenCells(
    movingObjects: SceneObject[],
    ignoredIds: ReadonlySet<number> = new Set(),
  ) {
    if (!this.cellBoard || !movingObjects.length) return;
    const moving = new Set(movingObjects);
    const occupied = this.objects.filter(
      (object) => !moving.has(object) && !ignoredIds.has(object.id),
    );
    const used = new Set<number>();
    const slots = this.gridCenters(this.cellBoard.capacity);
    for (const object of movingObjects) {
      const face = this.tileDimensions(object.surfaceBody);
      const open = slots
        .map((center, index) => ({ center, index }))
        .filter(
          ({ center, index }) =>
            !used.has(index) &&
            occupied.every((candidate) =>
              this.facesClear(
                center,
                face,
                candidate.surfaceBody.pose(),
                this.tileFootprint(candidate.surfaceBody),
              ),
            ),
        );
      if (!open.length) continue;
      const from = object.surfaceBody.pose();
      const { center, index } = open.reduce((best, candidate) =>
        Math.hypot(candidate.center.x - from.x, candidate.center.y - from.y) <
        Math.hypot(best.center.x - from.x, best.center.y - from.y)
          ? candidate
          : best,
      );
      const dx = center.x - from.x;
      const dy = center.y - from.y;
      object.surfaceBody.translate(dx, dy);
      object.body.translate(dx, dy);
      object.surfaceBody.setVelocity(0, 0);
      object.body.setVelocity(0, 0);
      used.add(index);
      occupied.push(object);
    }
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
    const silkSupport =
      style === "silk"
        ? prepareSilkSupportSurfaces(
            this.objects.map((object) => object.surfaceBody),
          )
        : undefined;
    return hitInk(point, ink, body, (binding) => {
      const position = body.at(binding);
      const reference =
        style === "draped" || style === "silk"
          ? body.idealAt(binding)
          : position;
      return projectInkPoint(
        position,
        surface,
        body,
        style,
        reference,
        surfacePose,
        silkSupport,
      ).point;
    });
  }

  setSoftness(softness: number) {
    this.softness = clamp(softness, 0, 1);
    for (const body of this.allBodies())
      body.softness = this.effectiveSoftness();
  }

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
    for (const body of this.allBodies()) body.reduced = reduced;
    if (reduced && this.tileAnimation) {
      for (const move of this.tileAnimation.moves) this.applyTilePose(move, 1);
      this.tileAnimation = null;
    }
  }

  reset(char?: string) {
    if (char === undefined && this.boardPreset === "cells") {
      this.startCellBoard(this.selectedCharacter);
      return;
    }
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
    if (this.contacts.size || this.preview || this.tileAnimation) {
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
    if (!this.cellBoard && this.boardPreset !== "custom")
      this.customStarts = this.objects.map((object) => ({
        char: object.char,
        center: { ...object.surfaceBody.pose() },
      }));
    if (!this.cellBoard) {
      this.customStarts ??= [];
      this.customStarts.push({ char, center: { ...center } });
      this.boardPreset = "custom";
    }
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
    if (this.contacts.size || this.preview || this.tileAnimation) {
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
        this.glyphScale,
        this.glyphScale,
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
      `Free pieces: ${source.recipe.parts[0].char} + ${source.recipe.parts[1].char}. Pull a stroke, double-tap a stroke or tile, or bring compatible pieces together.`,
    );
    this.events.push({
      type: "unfold",
      character: source.recipe.parts[0].char,
    });
    return "unfolded";
  }

  private findOpenTileCenter(): Point | null {
    if (this.cellBoard) {
      if (this.objects.length >= this.cellBoard.capacity) return null;
      const face = { width: this.tileFaceSize, height: this.tileFaceSize };
      return (
        this.gridCenters(this.cellBoard.capacity).find((center) =>
          this.objects.every((object) =>
            this.facesClear(
              center,
              face,
              object.surfaceBody.pose(),
              this.tileFootprint(object.surfaceBody),
            ),
          ),
        ) ?? null
      );
    }
    const halfSize = this.tileFaceSize / 2;
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
          halfSize + item.footprint[extent] / 2 + this.tileClearance;
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
            halfSize + footprint.width / 2 + this.tileClearance ||
          Math.abs(candidate.y - center.y) >=
            halfSize + footprint.height / 2 + this.tileClearance,
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
    const halfSize = this.tileFaceSize / 2;
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
      this.width >= this.tileFaceSize * 3 + 80
        ? 3
        : this.width >= this.tileFaceSize * 2 + this.tileClearance + 24
          ? 2
          : 1;
    const rows = Math.ceil(characters.length / columns);
    const margin = 12;
    const maxXSpan = Math.max(0, this.width - this.tileFaceSize - margin * 2);
    const maxYSpan = Math.max(0, this.height - this.tileFaceSize - margin * 2);
    const desiredXSpan = (columns - 1) * (this.tileFaceSize + 44);
    const desiredYSpan = (rows - 1) * (this.tileFaceSize + 44);
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
    const cellCount = this.cellBoard?.cells;
    const cellCharacters =
      preset === "cells"
        ? this.objects.map((object) => ({
            char: object.char,
            free: object.free,
            componentPiece: object.componentPiece,
          }))
        : null;
    this.cancelAll();
    this.width = width;
    this.height = height;
    this.compileAssets();
    if (preset === "cells" && cellCount) {
      this.setCellBoard(cellCount as 3 | 4 | 5 | 6);
      this.events.length = 0;
      this.boardPreset = "cells";
      this.objects = (cellCharacters ?? []).map((object, index) =>
        this.createObject(
          object.char,
          this.gridCenters(cellCharacters!.length)[index],
          object.free,
          undefined,
          undefined,
          { x: 0, y: 0 },
          object.componentPiece,
        ),
      );
      this.preview = null;
      this.setPhase(
        this.objects.length > 1 ? "loose" : "whole",
        `${this.objects.length} characters are ready on the grid.`,
      );
    } else if (preset === "starters") this.resetStarters();
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
    // The remainder stays anchored to its original tile while the pulled
    // component moves independently. Only the dragged part should react to
    // this gesture.
    restBody.setVelocity(0, 0);
    restBody.setFixed(true);
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
    };
    this.preview = preview;
    this.setPhase(
      "stretching",
      `Pull ${part.char} away. The rest stays in place.`,
    );
    return preview;
  }

  pointerDown(point: Point, pointerId: number) {
    if (this.contacts.has(pointerId) || this.tileAnimation) return false;
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
      for (const object of [...this.objectsInZOrder()].reverse()) {
        surfaceBody = object.surfaceBody;
        const onInk = this.containsInk(
          point,
          object.ink,
          object.body,
          surfaceBody,
        );
        const onTile =
          this.visualStyle !== "flat" &&
          hitTileFace(point, object.surfaceBody, this.visualStyle);
        if (!onInk && !onTile) continue;
        // Unsupported ink cannot tear, so let its visible strokes grab the
        // whole tile even when projection carries them beyond the tile face.
        if ((onInk && !object.recipe) || (onTile && !onInk)) {
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
    if (tileGrip) this.frontTileId = entityId;
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
    } else {
      const releasedObject = this.objects.find(
        (object) => object.id === contact.entityId,
      );
      const releasedTileFollowsInk =
        !contact.tileGrip && releasedObject?.tileFollowsInkUntilRelease;
      if (
        this.snapToGrid &&
        (contact.tileGrip ||
          releasedTileFollowsInk ||
          releasedObject?.snapAfterRelease) &&
        !this.findMagnet()
      ) {
        this.snapTileToGrid(contact.entityId);
        if (releasedObject) releasedObject.snapAfterRelease = false;
      }
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
    this.tileAnimation = null;
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
    if (this.tileAnimation) return;
    if (this.preview) {
      this.preview.restBody.nudge(x, y);
      this.preview.partBody.nudge(x, y);
    } else for (const object of this.objects) object.body.nudge(x, y);
  }

  private tileDimensions(surfaceBody: WobbleBody) {
    return {
      width: surfaceBody.size * surfaceBody.scaleX + this.tileFaceInset,
      height: surfaceBody.size * surfaceBody.scaleY + this.tileFaceInset,
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
        (faceA.width + faceB.width) / 2 + this.tileClearance ||
      Math.abs(centerA.y - centerB.y) >=
        (faceA.height + faceB.height) / 2 + this.tileClearance
    );
  }

  private planUnfold(source: SceneObject) {
    const recipe = source.recipe;
    if (!recipe) return null;
    if (this.cellBoard) {
      if (this.objects.length >= this.cellBoard.capacity) return null;
      const face = { width: this.tileFaceSize, height: this.tileFaceSize };
      const parent = source.surfaceBody.pose();
      const available = this.gridCenters(this.cellBoard.capacity)
        .filter((center) =>
          this.objects
            .filter((object) => object !== source)
            .every((object) =>
              this.facesClear(
                center,
                face,
                object.surfaceBody.pose(),
                this.tileFootprint(object.surfaceBody),
              ),
            ),
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - parent.x, a.y - parent.y) -
            Math.hypot(b.x - parent.x, b.y - parent.y),
        );
      return available.length >= 2
        ? { centers: [available[0], available[1]] }
        : null;
    }
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
    const face = { width: this.tileFaceSize, height: this.tileFaceSize };
    // Leave a pixel of slack so the exact target doesn't fail clearance from
    // floating-point rounding after the component vector is rescaled.
    const required = this.tileFaceSize + this.tileClearance + 1;
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
    const step = Math.max(12, Math.round(this.tileFaceSize / 3));
    const maxRing = Math.ceil(Math.max(this.width, this.height) / step);
    const offsets: Point[] = [{ x: 0, y: 0 }];
    for (let ring = 1; ring <= maxRing; ring++)
      for (let x = -ring; x <= ring; x++)
        for (let y = -ring; y <= ring; y++)
          if (Math.max(Math.abs(x), Math.abs(y)) === ring)
            offsets.push({ x: x * step, y: y * step });
    offsets.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));

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
    const requiredX = face.width + this.tileClearance;
    const requiredY = face.height + this.tileClearance;
    const x = Math.abs(second.center.x - first.center.x);
    const y = Math.abs(second.center.y - first.center.y);
    const withinBoard = placements.every(
      ({ center, face: tileFace }) =>
        center.x >= tileFace.width / 2 &&
        center.x <= this.width - tileFace.width / 2 &&
        center.y >= tileFace.height / 2 &&
        center.y <= this.height - tileFace.height / 2,
    );
    const hasCellCapacity =
      !this.cellBoard || this.objects.length < this.cellBoard.capacity;
    const ready =
      this.facesClear(first.center, first.face, second.center, second.face) &&
      withinBoard &&
      hasCellCapacity;
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
        this.glyphScale,
        this.glyphScale,
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
    if (this.cellBoard) {
      const heldObjectIds = new Set(
        [...heldGroups].map((index) => made[index].id),
      );
      this.placeOnOpenCells(
        made.filter((_, index) => !heldGroups.has(index)),
        heldObjectIds,
      );
    }
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
            parentScaleX = this.glyphScale,
            parentScaleY = this.glyphScale,
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
              Math.abs(expectedX) > this.tileClearance &&
              actualX * expectedX < -this.tileClearance * Math.abs(expectedX),
            reversedY =
              Math.abs(expectedY) > this.tileClearance &&
              actualY * expectedY < -this.tileClearance * Math.abs(expectedY);
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
        clamp(
          1 - match.distance / (this.tileFaceSize + this.tileClearance * 3),
          0,
          1,
        );
    const overlap = clamp(
      match.overlapDepth / (MAGNET_FULL_STRENGTH_OVERLAP * this.tileSizeRatio),
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
        const repulsionRange = TILE_REPULSION_RANGE * this.tileSizeRatio;
        const penetration = Math.min(gapX, gapY) + repulsionRange;
        if (penetration <= 0) continue;

        let dx = positionB.x - positionA.x;
        let dy = positionB.y - positionA.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) {
          dx = a.id < b.id ? 1 : -1;
          dy = 0;
          distance = 1;
        }
        const progress = clamp(penetration / repulsionRange, 0, 1);
        const compatible =
          magneticPair &&
          ((magneticPair.a === a && magneticPair.b === b) ||
            (magneticPair.a === b && magneticPair.b === a));
        const force =
          TILE_REPULSION_FORCE *
          this.tileSizeRatio *
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
    if (this.cellBoard) {
      const isHeld = [...this.contacts.values()].some(
        (contact) => contact.entityId === composed.id,
      );
      if (isHeld) composed.snapAfterRelease = true;
      else this.placeOnOpenCells([composed]);
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
    if (this.tileAnimation) return this.advanceTileAnimation(dt);
    if (this.preview) {
      this.preview.restBody.step(dt);
      this.preview.partBody.step(dt);
      const plan = this.planTear(this.preview);
      if (plan.clearance.ready) {
        this.commitTear(plan);
        return true;
      }
      this.message = plan.clearance.withinBoard
        ? "Keep pulling until the component clears its source tile."
        : "Guide the pulled component back inside the board before it separates.";
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
    return this.objectsInZOrder().flatMap((object) => {
      if (!preview || object !== preview.source)
        return [
          {
            ink: object.ink,
            body: object.body,
            surfaceBody: object.surfaceBody,
            character: object.char,
            objectId: object.id,
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
          objectId: object.id,
        },
        {
          ink: preview.partInk,
          body: preview.partBody,
          surfaceBody: object.surfaceBody,
          character: parts[preview.partIndex].char,
          objectId: object.id,
        },
      ];
    });
  }

  private objectsInZOrder() {
    if (this.frontTileId === null) return this.objects;
    const frontIndex = this.objects.findIndex(
      (object) => object.id === this.frontTileId,
    );
    if (frontIndex < 0 || frontIndex === this.objects.length - 1)
      return this.objects;
    return [
      ...this.objects.filter((object) => object.id !== this.frontTileId),
      this.objects[frontIndex],
    ];
  }

  connections() {
    return this.preview
      ? {
          tethers: [],
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
      snapToGrid: this.snapToGrid,
      animatingTiles: this.isAnimatingTiles,
      manipulating: this.isManipulating,
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
            tetherCount: 0,
            restCenter: this.preview.restBody.pose(),
            restInkCenter: inkCenter(
              this.preview.restInk,
              this.preview.restBody,
            ),
            sourceTileCenter: this.preview.source.surfaceBody.pose(),
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

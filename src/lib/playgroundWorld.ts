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
};

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
  recipe: Recipe | null;
};
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
  layoutA: ComponentLayout;
  layoutB: ComponentLayout;
  anchorA: Point;
  anchorB: Point;
  errorX: number;
  errorY: number;
  distance: number;
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
    ready: boolean;
  };
};

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const TILE_FACE_INSET = 38;
const TILE_FACE_SIZE = 184;
const TILE_CLEARANCE = 12;

export class PlaygroundWorld {
  private readonly assets: PlaygroundAssets;
  private readonly glyphGeometries = new Map<string, GlyphGeometry>();
  private recipes: Recipe[] = [];
  private recipeByChar = new Map<string, Recipe>();
  private objects: SceneObject[] = [];
  private preview: TearPreview | null = null;
  private contacts = new Map<number, Contact>();
  private nextId = 1;
  private elapsed = 0;
  private readonly attractionRadius = TILE_FACE_SIZE + TILE_CLEARANCE * 3;
  private readonly snapRadius = 12;
  phase: "whole" | "stretching" | "loose" = "whole";
  message = "Pull a component outward. Stretch its seam to tear it free.";
  selectedCharacter = "想";
  physicsMode: PhysicsMode = "fixed";
  visualStyle: VisualStyle = "raised";
  softness = 0.55;
  reduced = false;

  constructor(
    private width: number,
    private height: number,
    assets: PlaygroundAssets,
  ) {
    this.assets = assets;
    this.compileAssets();
    this.reset("想");
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

  get pointerIds() {
    return [...this.contacts.keys()];
  }

  get isReady() {
    return this.objects.length > 0;
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
    scaleX = 0.42,
    scaleY = 0.42,
    velocity: Point = { x: 0, y: 0 },
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
      recipe: this.recipeByChar.get(char) ?? null,
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

  reset(char = this.selectedCharacter) {
    this.cancelAll();
    this.selectedCharacter = this.recipeByChar.has(char) ? char : "想";
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
      "Pull a component outward. Stretch its seam to tear it free.",
    );
  }

  resize(width: number, height: number) {
    const selected = this.selectedCharacter;
    this.cancelAll();
    this.width = width;
    this.height = height;
    this.compileAssets();
    this.reset(selected);
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
        if (!onInk && onTile) {
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
    let ready = this.facesClear(
      first.center,
      first.face,
      second.center,
      second.face,
    );
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
        ready,
      },
    };
  }

  private commitTear(plan: TearPlan) {
    const preview = this.preview;
    if (!preview) return;
    const source = preview.source;
    const recipe = source.recipe!;
    const made = recipe.parts.map((part, index) => {
      const { center, layout } = plan.placements[index];
      const groupBody =
        index === preview.partIndex ? preview.partBody : preview.restBody;
      return this.createObject(
        part.char,
        center,
        true,
        layout.scaleX,
        layout.scaleY,
        groupBody.meanVelocity(),
      );
    });
    const sourceCenter = source.body.pose();
    for (const object of made) {
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
    }
    this.preview = null;
    this.setPhase(
      "loose",
      `Free pieces: ${recipe.parts[0].char} + ${recipe.parts[1].char}. Bring them together in the matching layout.`,
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
        for (const recipe of this.recipes) {
          const first = recipe.parts[0].char,
            second = recipe.parts[1].char;
          let partA: PartAsset, partB: PartAsset;
          if (a.char === first && b.char === second) {
            [partA, partB] = recipe.parts;
          } else if (a.char === second && b.char === first) {
            [partA, partB] = [recipe.parts[1], recipe.parts[0]];
          } else continue;
          const baseLayoutA = partA.layout,
            baseLayoutB = partB.layout,
            parentScaleX =
              (a.body.scaleX / baseLayoutA.scaleX +
                b.body.scaleX / baseLayoutB.scaleX) /
              2,
            parentScaleY =
              (a.body.scaleY / baseLayoutA.scaleY +
                b.body.scaleY / baseLayoutB.scaleY) /
              2,
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
          if (!best || distance < best.distance)
            best = {
              recipe,
              a,
              b,
              layoutA,
              layoutB,
              anchorA,
              anchorB,
              errorX,
              errorY,
              distance,
              parentScaleX,
              parentScaleY,
            };
        }
      }
    }
    return best && best.distance <= this.attractionRadius ? best : null;
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
      targetFrom: {
        x: centerX + match.layoutA.parentOffset.x,
        y: centerY + match.layoutA.parentOffset.y,
      },
      targetTo: {
        x: centerX + match.layoutB.parentOffset.x,
        y: centerY + match.layoutB.parentOffset.y,
      },
      distance: match.distance,
      strength: clamp(1 - match.distance / this.attractionRadius, 0, 1),
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
    const composed = this.createObject(
      match.recipe.char,
      center,
      false,
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
    const strength = clamp(1 - match.distance / this.attractionRadius, 0, 1);
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
        this.message = "Keep pulling until the tile faces have room.";
      } else {
        const part =
          this.preview.source.recipe!.parts[this.preview.partIndex].char;
        this.message = `Pull ${part} away. The rest resists and gives a little.`;
      }
      return false;
    }
    const magneticPair = this.findMagnet();
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
      const aligning =
        magneticPair?.a.id === object.id || magneticPair?.b.id === object.id;
      if (this.visualStyle !== "flat" && !held && !aligning)
        object.body.restorePose(surfaceAfter, dt);
      object.body.step(dt);
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
    if (this.preview)
      return [
        {
          ink: this.preview.restInk,
          body: this.preview.restBody,
          surfaceBody: this.preview.source.surfaceBody,
        },
        {
          ink: this.preview.partInk,
          body: this.preview.partBody,
          surfaceBody: this.preview.source.surfaceBody,
        },
      ];
    return this.objects.map((object) => ({
      ink: object.ink,
      body: object.body,
      surfaceBody: object.surfaceBody,
    }));
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
      coordinates: "CSS pixels from canvas top-left; x right, y down",
      physicsMode: this.physicsMode,
      visualStyle: this.visualStyle,
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

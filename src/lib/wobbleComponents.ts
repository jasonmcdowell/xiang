import { WobbleBody, type Binding, type Point } from "./wobble";
import type { Ink } from "./wobbleDrawing";
import type { GlyphGeometry } from "./wobbleDrawing";

export type Tether = { parent: Binding; part: Binding; rest: number };
type Candidate = {
  parent: Binding;
  part: Binding;
  a: Point;
  b: Point;
  distance: number;
};

export type ComponentLayout = {
  scaleX: number;
  scaleY: number;
  parentOffset: Point;
  standaloneOffset: Point;
  bodyOffset: Point;
};

export function glyphOffset(center: Point, body: WobbleBody): Point {
  return {
    x: (center.x / 1024 - 0.5) * body.size * body.scaleX,
    y: ((900 - center.y) / 1024 - 0.5) * body.size * body.scaleY,
  };
}

export function componentLayout(
  parent: WobbleBody,
  embedded: GlyphGeometry,
  standalone: GlyphGeometry,
): ComponentLayout {
  const width = Math.max(1, standalone.bounds.right - standalone.bounds.left);
  const height = Math.max(1, standalone.bounds.bottom - standalone.bounds.top);
  const scaleX =
    parent.scaleX *
    ((embedded.bounds.right - embedded.bounds.left) / width || 1);
  const scaleY =
    parent.scaleY *
    ((embedded.bounds.bottom - embedded.bounds.top) / height || 1);
  const childShape = new WobbleBody(
    parent.width,
    parent.height,
    scaleX,
    scaleY,
  );
  const parentOffset = glyphOffset(embedded.center, parent);
  const standaloneOffset = glyphOffset(standalone.center, childShape);
  return {
    scaleX,
    scaleY,
    parentOffset,
    standaloneOffset,
    bodyOffset: {
      x: parentOffset.x - standaloneOffset.x,
      y: parentOffset.y - standaloneOffset.y,
    },
  };
}

export function connectAtSeam(
  parentInk: Ink,
  partInk: Ink,
  parent: WobbleBody,
  part: WobbleBody,
): Tether[] {
  const candidates: Candidate[] = [];
  for (const parentStroke of parentInk)
    for (const partStroke of partInk)
      for (let i = 0; i < parentStroke.length; i += 3)
        for (let j = 0; j < partStroke.length; j += 3) {
          const a = parent.at(parentStroke[i]),
            b = part.at(partStroke[j]);
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          candidates.push({
            parent: parentStroke[i],
            part: partStroke[j],
            a,
            b,
            distance,
          });
        }
  candidates.sort((a, b) => a.distance - b.distance);
  const chosen: Candidate[] = [];
  for (const candidate of candidates) {
    if (candidate.distance > Math.max(18, parent.glyphSize * 0.17)) break;
    if (
      chosen.every(
        (c) =>
          Math.hypot(c.a.x - candidate.a.x, c.a.y - candidate.a.y) >
            parent.glyphSize * 0.09 &&
          Math.hypot(c.b.x - candidate.b.x, c.b.y - candidate.b.y) >
            part.glyphSize * 0.09,
      )
    )
      chosen.push(candidate);
    if (chosen.length === 3) break;
  }
  // A single soft tether is still a useful graceful fallback if the source's
  // stroke samples don't produce three distinct points at the seam.
  if (!chosen.length && candidates.length) chosen.push(candidates[0]);
  return chosen.map((c) => ({
    parent: c.parent,
    part: c.part,
    rest: c.distance,
  }));
}

export function coupleComponents(
  parent: WobbleBody,
  part: WobbleBody,
  tethers: Tether[],
  dt: number,
) {
  const tearAt = Math.max(18, parent.glyphSize * 0.12);
  for (const tether of tethers) {
    const a = parent.at(tether.parent),
      b = part.at(tether.part);
    if (Math.hypot(a.x - b.x, a.y - b.y) - tether.rest > tearAt) return true;
  }
  // Reduced motion keeps each ink layer rigid; the tear threshold remains so
  // the same direct manipulation still works without spring oscillation.
  if (parent.reduced || part.reduced) return false;
  for (let iteration = 0; iteration < 2; iteration++)
    for (const tether of tethers) {
      const a = parent.at(tether.parent),
        b = part.at(tether.part);
      const dx = b.x - a.x,
        dy = b.y - a.y,
        distance = Math.hypot(dx, dy) || 1;
      const magnitude = (distance - tether.rest) * 0.12;
      parent.apply(
        tether.parent,
        (dx / distance) * magnitude * 0.24,
        (dy / distance) * magnitude * 0.24,
        dt,
      );
      part.apply(
        tether.part,
        (-dx / distance) * magnitude * 0.76,
        (-dy / distance) * magnitude * 0.76,
        dt,
      );
    }
  return false;
}

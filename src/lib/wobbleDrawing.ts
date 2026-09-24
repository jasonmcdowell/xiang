import { WobbleBody, type Binding, type Point } from "./wobble";
import type { Tether } from "./wobbleComponents";

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const SILK_DEPTH_X = 8;
const SILK_DEPTH_Y = 24;

export type Ink = Binding[][];
export type VisualStyle = "flat" | "raised" | "draped" | "silk";
export type InkLayer = {
  ink: Ink;
  body: WobbleBody;
  surfaceBody?: WobbleBody;
  character?: string;
};
export type GlyphGeometry = {
  center: Point;
  bounds: { left: number; right: number; top: number; bottom: number };
};

export function measureGlyph(strokes: string[]): GlyphGeometry {
  const points: Point[] = [];
  for (const d of strokes) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const length = path.getTotalLength();
    const samples = Math.max(12, Math.ceil(length / 12));
    for (let i = 0; i < samples; i++)
      points.push(path.getPointAtLength((length * i) / samples));
  }
  if (!points.length)
    return {
      center: { x: 512, y: 450 },
      bounds: { left: 0, right: 1024, top: 0, bottom: 900 },
    };
  return {
    center: {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    },
    bounds: {
      left: Math.min(...points.map((point) => point.x)),
      right: Math.max(...points.map((point) => point.x)),
      top: Math.min(...points.map((point) => point.y)),
      bottom: Math.max(...points.map((point) => point.y)),
    },
  };
}

export function inkCenter(ink: Ink, body: WobbleBody): Point {
  let x = 0,
    y = 0,
    count = 0;
  for (const stroke of ink)
    for (let i = 0; i < stroke.length; i += 5) {
      const point = body.at(stroke[i]);
      x += point.x;
      y += point.y;
      count++;
    }
  return count ? { x: x / count, y: y / count } : body.pose();
}

export function facingBinding(ink: Ink, body: WobbleBody, direction: Point) {
  let best = ink[0]?.[0] ?? body.bind(0.5, 0.5);
  let bestProjection = -Infinity;
  for (const stroke of ink)
    for (let i = 0; i < stroke.length; i += 3) {
      const binding = stroke[i];
      const point = body.at(binding);
      const projection = point.x * direction.x + point.y * direction.y;
      if (projection > bestProjection) {
        best = binding;
        bestProjection = projection;
      }
    }
  return best;
}

export function skinStrokes(strokes: string[], body: WobbleBody): Ink {
  return strokes.map((d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const length = path.getTotalLength();
    const samples = Math.max(16, Math.ceil(length / 5));
    return Array.from({ length: samples }, (_, i) => {
      const p = path.getPointAtLength((length * i) / samples);
      return body.bind(p.x / 1024, (900 - p.y) / 1024);
    });
  });
}

export function hitInk(
  point: Point,
  ink: Ink,
  body: WobbleBody,
  locate: (binding: Binding) => Point = (binding) => body.at(binding),
) {
  for (const stroke of ink) {
    const polygon = stroke.map(locate);
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j],
        b = polygon[i];
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
      // Eight CSS pixels of forgiveness around thin strokes, also on touch.
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      );
      if ((point.x - a.x - dx * t) ** 2 + (point.y - a.y - dy * t) ** 2 <= 64)
        return true;
    }
    if (inside) return true;
  }
  return false;
}

export function hitTileFace(
  point: Point,
  body: WobbleBody,
  style: VisualStyle = "raised",
) {
  const pose = body.pose();
  const dx = point.x - pose.x;
  const dy = point.y - pose.y;
  const c = Math.cos(pose.angle);
  const s = Math.sin(pose.angle);
  const localX = c * dx + s * dy;
  const localY = -s * dx + c * dy;
  const halfWidth = (body.size * body.scaleX + 38) / 2;
  const halfHeight = (body.size * body.scaleY + 38) / 2;
  const onFace =
    Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
  const offsetX = style === "silk" ? SILK_DEPTH_X : 5;
  const offsetY = style === "silk" ? SILK_DEPTH_Y : 11;
  const onOffsetBase =
    Math.abs(localX - offsetX) <= halfWidth &&
    Math.abs(localY - offsetY) <= halfHeight;
  return onFace || onOffsetBase;
}

export function projectInkPoint(
  point: Point,
  surface: WobbleBody,
  inkBody: WobbleBody,
  style: VisualStyle,
  reference: Point,
  surfacePose = surface.pose(),
  supportSurfaces: WobbleBody[] = [surface],
) {
  if (style === "flat") return { point, drape: 0 };
  if (style === "raised")
    return {
      point: { x: point.x, y: point.y - 3 - inkBody.lift * 7 },
      drape: 0,
    };

  if (style === "silk") {
    let nearestOutside = Number.POSITIVE_INFINITY;
    let support = 0;
    for (const candidate of supportSurfaces) {
      const pose = candidate === surface ? surfacePose : candidate.pose();
      const dx = point.x - pose.x;
      const dy = point.y - pose.y;
      const c = Math.cos(pose.angle);
      const s = Math.sin(pose.angle);
      const localX = c * dx + s * dy;
      const localY = -s * dx + c * dy;
      const halfWidth = (candidate.size * candidate.scaleX + 38) / 2 - 3;
      const halfHeight = (candidate.size * candidate.scaleY + 38) / 2 - 3;
      const outside = Math.max(
        Math.abs(localX) - halfWidth,
        Math.abs(localY) - halfHeight,
        0,
      );
      if (outside < nearestOutside) nearestOutside = outside;
      if (outside === 0) support = 1;
    }
    const edgeT = clamp(nearestOutside / 19, 0, 1);
    const edgeDrop = edgeT * edgeT * (3 - 2 * edgeT);
    const pulled = Math.hypot(point.x - reference.x, point.y - reference.y);
    const pullT = clamp((pulled - 14) / 46, 0, 1);
    const pullDrop = pullT * pullT * (3 - 2 * pullT);
    const drop = Math.max(edgeDrop, pullDrop * (1 - support));
    // Screen-space height: ink sinks below the tile top at its own edge, but
    // rises again when its path crosses the top of another tile.
    return {
      point: {
        x: point.x + SILK_DEPTH_X * drop,
        y: point.y + SILK_DEPTH_Y * drop,
      },
      drape: drop,
    };
  }

  const dx = point.x - surfacePose.x;
  const dy = point.y - surfacePose.y;
  const c = Math.cos(surfacePose.angle);
  const s = Math.sin(surfacePose.angle);
  const localX = c * dx + s * dy;
  const localY = -s * dx + c * dy;
  const halfWidth = (surface.size * surface.scaleX) / 2 + 18;
  const halfHeight = (surface.size * surface.scaleY) / 2 + 18;
  const outside = Math.max(
    Math.abs(localX) - halfWidth,
    Math.abs(localY) - halfHeight,
    0,
  );
  const edgeT = clamp(outside / 22, 0, 1);
  const edgeDrape = edgeT * edgeT * (3 - 2 * edgeT);
  const pulled = Math.hypot(point.x - reference.x, point.y - reference.y);
  const pullT = clamp((pulled - 8) / 34, 0, 1);
  const pullDrape = pullT * pullT * (3 - 2 * pullT);
  const drape = Math.max(edgeDrape, pullDrape);
  const depth = 19 * drape;
  const lift = inkBody.lift * 5 * (1 - drape);
  // The fixed camera shows the tile's front/right thickness as a shallow
  // down-and-right projection. The same profile is used by canvas hit tests.
  const offsetX = (c * 0.42 - s * 0.9) * depth;
  const offsetY = (s * 0.42 + c * 0.9) * depth - lift;
  return {
    point: { x: point.x + offsetX, y: point.y + offsetY },
    drape,
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawMahjongTile(
  ctx: CanvasRenderingContext2D,
  body: WobbleBody,
  ratio: number,
  style: VisualStyle,
) {
  const pose = body.pose();
  const width = body.size * body.scaleX + 38;
  const height = body.size * body.scaleY + 38;
  const left = -width / 2;
  const top = -height / 2;
  const sideX = style === "silk" ? SILK_DEPTH_X : 5;
  const sideY = style === "silk" ? SILK_DEPTH_Y : 11;
  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.shadowColor = "rgba(48, 43, 31, .24)";
  ctx.shadowBlur = 17;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = sideY + 6;
  roundedRect(ctx, left + sideX, top + sideY, width, height, 20);
  ctx.fillStyle = "#a89069";
  ctx.fill();
  ctx.shadowColor = "transparent";

  if (style === "silk") {
    const side = ctx.createLinearGradient(
      0,
      top + height - 2,
      0,
      top + height + sideY,
    );
    side.addColorStop(0, "#b29968");
    side.addColorStop(0.45, "#90754e");
    side.addColorStop(1, "#6e5d43");
    ctx.beginPath();
    ctx.moveTo(left + 14, top + height - 2);
    ctx.lineTo(left + width - 14, top + height - 2);
    ctx.lineTo(left + width - 14 + sideX, top + height - 2 + sideY);
    ctx.lineTo(left + 14 + sideX, top + height - 2 + sideY);
    ctx.closePath();
    ctx.fillStyle = side;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(left + width - 2, top + 15);
    ctx.lineTo(left + width - 2, top + height - 15);
    ctx.lineTo(left + width - 2 + sideX, top + height - 15 + sideY);
    ctx.lineTo(left + width - 2 + sideX, top + 15 + sideY);
    ctx.closePath();
    ctx.fillStyle = "#8b724e";
    ctx.fill();
  }

  const face = ctx.createLinearGradient(left, top, left + width, top + height);
  face.addColorStop(0, "#fffdf5");
  face.addColorStop(0.55, "#f2eddf");
  face.addColorStop(1, "#e5dcc8");
  roundedRect(ctx, left, top, width, height, 19);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(143, 120, 80, .54)";
  ctx.stroke();
  roundedRect(ctx, left + 6, top + 6, width - 12, height - 12, 14);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 249, .92)";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left + 22, top + height - 8);
  ctx.lineTo(left + width - 22, top + height - 8);
  ctx.strokeStyle = "rgba(133, 110, 74, .16)";
  ctx.stroke();
  ctx.restore();
}

function makeInkPath(
  ink: Ink,
  locate: (binding: Binding) => { point: Point; drape: number },
) {
  const path = new Path2D();
  let drape = 0;
  for (const stroke of ink) {
    stroke.forEach((binding, i) => {
      const projected = locate(binding);
      drape = Math.max(drape, projected.drape);
      if (i === 0) path.moveTo(projected.point.x, projected.point.y);
      else path.lineTo(projected.point.x, projected.point.y);
    });
    path.closePath();
  }
  return { path, drape };
}

export function drawLayers(
  ctx: CanvasRenderingContext2D,
  layers: InkLayer[],
  ratio: number,
  style: VisualStyle = "flat",
) {
  const body = layers[0]?.surfaceBody ?? layers[0]?.body;
  if (!body) return;
  const supportSurfaces = [
    ...new Set(layers.map((layer) => layer.surfaceBody ?? layer.body)),
  ];
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, body.width, body.height);
  const drawnSurfaces = new Set<WobbleBody>();
  for (const layer of layers) {
    const surface = layer.surfaceBody ?? layer.body;
    const surfacePose = surface.pose();
    if (style !== "flat" && !drawnSurfaces.has(surface)) {
      drawMahjongTile(ctx, surface, ratio, style);
      drawnSurfaces.add(surface);
    }
    const projected = makeInkPath(layer.ink, (binding) => {
      const point = layer.body.at(binding);
      const reference =
        style === "draped" || style === "silk"
          ? layer.body.idealAt(binding)
          : point;
      return projectInkPoint(
        point,
        surface,
        layer.body,
        style,
        reference,
        surfacePose,
        supportSurfaces,
      );
    });
    const { path } = projected;
    ctx.save();
    if (style === "raised") {
      const relief = 4 + layer.body.lift * 8;
      ctx.save();
      ctx.translate(0, relief);
      ctx.fillStyle = "#17392f";
      ctx.fill(path);
      ctx.restore();
      ctx.shadowColor = `rgba(28, 40, 33, ${0.14 + layer.body.lift * 0.17})`;
      ctx.shadowBlur = 4 + layer.body.lift * 10;
      ctx.shadowOffsetY = 5 + layer.body.lift * 10;
      ctx.fillStyle = "#254538";
      ctx.fill(path);
    } else if (style === "draped") {
      const shadow = Math.max(projected.drape * 0.28, layer.body.lift * 0.2);
      if (shadow > 0.015) {
        ctx.save();
        ctx.globalAlpha = shadow;
        ctx.shadowColor = "rgba(28, 31, 27, .42)";
        ctx.shadowBlur = 7 + projected.drape * 6;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 13;
        ctx.fillStyle = "#1f2923";
        ctx.fill(path);
        ctx.restore();
      }
      if (projected.drape > 0.02) {
        ctx.save();
        ctx.translate(0, 2 + projected.drape * 2);
        ctx.fillStyle = "#19372e";
        ctx.fill(path);
        ctx.restore();
      }
      ctx.shadowColor = `rgba(28, 40, 33, ${layer.body.lift * 0.1})`;
      ctx.shadowBlur = layer.body.lift * 5;
      ctx.shadowOffsetY = layer.body.lift * 7;
      ctx.fillStyle = "#254538";
      ctx.fill(path);
    } else if (style === "silk") {
      if (projected.drape > 0.015) {
        ctx.save();
        ctx.globalAlpha = 0.11 + projected.drape * 0.19;
        ctx.shadowColor = "rgba(22, 25, 21, .42)";
        ctx.shadowBlur = 5 + projected.drape * 8;
        ctx.shadowOffsetX = 5 + projected.drape * 2;
        ctx.shadowOffsetY = 8 + projected.drape * 12;
        ctx.fillStyle = "#1d2923";
        ctx.fill(path);
        ctx.restore();
      }
      if (projected.drape > 0.025) {
        ctx.save();
        ctx.translate(0, 1 + projected.drape * 2);
        ctx.fillStyle = "#17372f";
        ctx.fill(path);
        ctx.restore();
      }
      ctx.shadowColor = "rgba(19, 27, 22, .16)";
      ctx.shadowBlur = 3 + projected.drape * 4;
      ctx.shadowOffsetY = 2 + projected.drape * 4;
      ctx.fillStyle = "#254538";
      ctx.fill(path);
      ctx.save();
      ctx.strokeStyle = "rgba(226, 235, 216, .2)";
      ctx.lineWidth = 1;
      ctx.stroke(path);
      ctx.restore();
    } else {
      ctx.shadowColor = `rgba(33, 55, 40, ${layer.body.lift * 0.2})`;
      ctx.shadowBlur = 14 * layer.body.lift;
      ctx.shadowOffsetY = 12 * layer.body.lift;
      ctx.fillStyle = "#254538";
      ctx.fill(path);
    }
    ctx.restore();
    for (const grab of layer.body.grabs.values()) {
      const point = layer.body.at(grab.binding);
      const reference =
        style === "draped" || style === "silk"
          ? layer.body.idealAt(grab.binding)
          : point;
      const pin = projectInkPoint(
        point,
        surface,
        layer.body,
        style,
        reference,
        surfacePose,
        supportSurfaces,
      ).point;
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#c56a47";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
}

export function drawInk(
  ctx: CanvasRenderingContext2D,
  ink: Ink,
  body: WobbleBody,
  ratio: number,
) {
  drawLayers(ctx, [{ ink, body }], ratio);
}

export function drawConnections(
  ctx: CanvasRenderingContext2D,
  tethers: Tether[],
  parent: WobbleBody,
  part: WobbleBody,
  ratio: number,
) {
  if (!tethers.length) return;
  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(197, 106, 71, .72)";
  ctx.fillStyle = "#f7f6f0";
  ctx.setLineDash([3, 4]);
  for (const tether of tethers) {
    const a = parent.at(tether.parent);
    const b = part.at(tether.part);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 8, b.x, b.y);
    ctx.stroke();
    for (const point of [a, b]) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawMagnet(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  targetFrom: Point,
  targetTo: Point,
  strength: number,
  ratio: number,
) {
  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineWidth = 1 + strength;
  ctx.strokeStyle = `rgba(197, 106, 71, ${0.2 + strength * 0.55})`;
  ctx.fillStyle = "#f7f6f0";
  ctx.setLineDash([3 + strength * 2, 5]);
  for (const [a, b] of [
    [from, targetFrom],
    [to, targetTo],
  ]) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(
    (from.x + to.x) / 2,
    (from.y + to.y) / 2 - 5,
    to.x,
    to.y,
  );
  ctx.stroke();
  for (const point of [from, to]) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3 + strength * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

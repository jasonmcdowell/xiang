// A small deformable lattice. Stroke outlines are skinned to its nodes; ink
// detail never increases the number of particles the physics has to solve.
export type Point = { x: number; y: number };
export type Binding = { ids: number[]; weights: number[] };
type Node = Point & { rx: number; ry: number; vx: number; vy: number };
type Link = { a: number; b: number; length: number; strength: number };
type Grab = { binding: Binding; target: Point };
type WholeGrab = { offset: Point; target: Point; velocity: Point };
const GRID = 7;
export const STEP = 1 / 120;
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const angleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

export class WobbleBody {
  nodes: Node[] = [];
  links: Link[] = [];
  grabs = new Map<number, Grab>();
  wholeGrabs = new Map<number, WholeGrab>();
  softness = 0.55;
  reduced = false;
  lift = 0;
  size = 1;
  fixed = false;
  fixedCenter: Point;
  grabStrength = 0.8;
  constructor(
    public width: number,
    public height: number,
    public scaleX = 1,
    public scaleY = 1,
  ) {
    this.fixedCenter = { x: width / 2, y: height / 2 };
    this.reset();
  }

  get glyphSize() {
    return this.size * Math.max(this.scaleX, this.scaleY);
  }

  reset() {
    this.grabs.clear();
    this.wholeGrabs.clear();
    this.lift = 0;
    this.fixedCenter = { x: this.width / 2, y: this.height / 2 };
    this.size = Math.min(390, this.width * 0.8, this.height * 0.75);
    this.nodes = [];
    this.links = [];
    for (let row = 0; row < GRID; row++)
      for (let col = 0; col < GRID; col++) {
        const rx = (col / (GRID - 1) - 0.5) * this.size * this.scaleX;
        const ry = (row / (GRID - 1) - 0.5) * this.size * this.scaleY;
        this.nodes.push({
          x: this.width / 2 + rx,
          y: this.height / 2 + ry,
          rx,
          ry,
          vx: 0,
          vy: 0,
        });
      }
    for (let row = 0; row < GRID; row++)
      for (let col = 0; col < GRID; col++) {
        for (const [dx, dy, strength] of [
          [1, 0, 0.3],
          [0, 1, 0.3],
          [1, 1, 0.06],
          [-1, 1, 0.06],
        ]) {
          if (col + dx < 0 || col + dx >= GRID || row + dy >= GRID) continue;
          const a = row * GRID + col,
            b = (row + dy) * GRID + col + dx;
          this.links.push({
            a,
            b,
            length: Math.hypot(
              this.nodes[a].rx - this.nodes[b].rx,
              this.nodes[a].ry - this.nodes[b].ry,
            ),
            strength,
          });
        }
      }
  }

  // u/v are glyph-space coordinates in [0,1]. Bilinear skinning gives a
  // continuous warp even across the invisible cells between disconnected ink.
  bind(u: number, v: number): Binding {
    const gx = clamp(u, 0, 1) * (GRID - 1),
      gy = clamp(v, 0, 1) * (GRID - 1);
    const col = Math.min(GRID - 2, Math.floor(gx)),
      row = Math.min(GRID - 2, Math.floor(gy));
    const x = gx - col,
      y = gy - row,
      a = row * GRID + col;
    return {
      ids: [a, a + 1, a + GRID, a + GRID + 1],
      weights: [(1 - x) * (1 - y), x * (1 - y), (1 - x) * y, x * y],
    };
  }
  at(binding: Binding): Point {
    let x = 0,
      y = 0;
    binding.ids.forEach((id, i) => {
      x += this.nodes[id].x * binding.weights[i];
      y += this.nodes[id].y * binding.weights[i];
    });
    return { x, y };
  }
  idealAt(binding: Binding, pose = this.pose()): Point {
    const c = Math.cos(pose.angle);
    const s = Math.sin(pose.angle);
    let x = 0,
      y = 0;
    binding.ids.forEach((id, i) => {
      const node = this.nodes[id];
      x += (pose.x + c * node.rx - s * node.ry) * binding.weights[i];
      y += (pose.y + s * node.rx + c * node.ry) * binding.weights[i];
    });
    return { x, y };
  }
  start(point: Point, pointerId = 0): Binding {
    // Invert the current lattice, so a second grab does not jump to its old,
    // undeformed location. Newton iterations solve each bilinear cell.
    let best = this.bind(0.5, 0.5),
      bestDistance = Infinity;
    for (let row = 0; row < GRID - 1; row++)
      for (let col = 0; col < GRID - 1; col++) {
        let u = 0.5,
          v = 0.5;
        const a = this.nodes[row * GRID + col],
          b = this.nodes[row * GRID + col + 1];
        const c = this.nodes[(row + 1) * GRID + col],
          d = this.nodes[(row + 1) * GRID + col + 1];
        for (let i = 0; i < 8; i++) {
          const px =
            a.x * (1 - u) * (1 - v) +
            b.x * u * (1 - v) +
            c.x * (1 - u) * v +
            d.x * u * v;
          const py =
            a.y * (1 - u) * (1 - v) +
            b.y * u * (1 - v) +
            c.y * (1 - u) * v +
            d.y * u * v;
          const ux = (b.x - a.x) * (1 - v) + (d.x - c.x) * v,
            uy = (b.y - a.y) * (1 - v) + (d.y - c.y) * v;
          const vx = (c.x - a.x) * (1 - u) + (d.x - b.x) * u,
            vy = (c.y - a.y) * (1 - u) + (d.y - b.y) * u;
          const determinant = ux * vy - uy * vx;
          if (Math.abs(determinant) < 0.001) break;
          u = clamp(
            u + ((point.x - px) * vy - (point.y - py) * vx) / determinant,
            0,
            1,
          );
          v = clamp(
            v + (ux * (point.y - py) - uy * (point.x - px)) / determinant,
            0,
            1,
          );
        }
        const binding = this.bind(
          (col + u) / (GRID - 1),
          (row + v) / (GRID - 1),
        );
        const p = this.at(binding),
          distance = Math.hypot(p.x - point.x, p.y - point.y);
        if (distance < bestDistance) {
          best = binding;
          bestDistance = distance;
        }
      }
    this.attach(pointerId, best, point);
    return best;
  }
  startWholeDrag(point: Point, pointerId = 0): Binding {
    const pose = this.pose();
    this.wholeGrabs.set(pointerId, {
      offset: { x: pose.x - point.x, y: pose.y - point.y },
      target: { ...point },
      velocity: { x: 0, y: 0 },
    });
    for (const node of this.nodes) {
      node.vx = 0;
      node.vy = 0;
    }
    return this.bind(0.5, 0.5);
  }
  moveWhole(point: Point, pointerId = 0) {
    const grab = this.wholeGrabs.get(pointerId);
    if (!grab) return;
    const target = {
      x: clamp(point.x, 24, this.width - 24),
      y: clamp(point.y, 24, this.height - 24),
    };
    if (!this.fixed) {
      const pose = this.pose();
      const centerX = clamp(
        target.x + grab.offset.x,
        (this.size * this.scaleX + 38) / 2,
        this.width - (this.size * this.scaleX + 38) / 2,
      );
      const centerY = clamp(
        target.y + grab.offset.y,
        (this.size * this.scaleY + 38) / 2,
        this.height - (this.size * this.scaleY + 38) / 2,
      );
      const dx = centerX - pose.x;
      const dy = centerY - pose.y;
      if (dx || dy) {
        const response = this.reduced || this.grabStrength > 1 ? 1 : 0.82;
        this.setCenter(pose.x + dx * response, pose.y + dy * response);
        grab.velocity = {
          x: this.reduced ? 0 : clamp(dx * response * 60, -1200, 1200),
          y: this.reduced ? 0 : clamp(dy * response * 60, -1200, 1200),
        };
      }
    }
    for (const node of this.nodes) {
      node.vx = 0;
      node.vy = 0;
    }
    grab.target = target;
    const center = this.pose();
    for (const other of this.wholeGrabs.values())
      other.offset = {
        x: center.x - other.target.x,
        y: center.y - other.target.y,
      };
  }
  releaseWhole(pointerId?: number) {
    if (pointerId === undefined) this.wholeGrabs.clear();
    else {
      const released = this.wholeGrabs.get(pointerId);
      this.wholeGrabs.delete(pointerId);
      if (released && !this.wholeGrabs.size && !this.fixed && !this.reduced)
        for (const node of this.nodes) {
          node.vx = released.velocity.x;
          node.vy = released.velocity.y;
        }
    }
  }
  attach(pointerId: number, binding: Binding, point: Point) {
    this.grabs.set(pointerId, { binding, target: { ...point } });
  }
  copy() {
    const body = new WobbleBody(
      this.width,
      this.height,
      this.scaleX,
      this.scaleY,
    );
    body.nodes = this.nodes.map((n) => ({ ...n }));
    body.softness = this.softness;
    body.reduced = this.reduced;
    body.lift = this.lift;
    body.fixed = this.fixed;
    body.fixedCenter = { ...this.fixedCenter };
    body.grabStrength = this.grabStrength;
    return body;
  }
  static blend(a: WobbleBody, b: WobbleBody, weightB: number) {
    const weight = clamp(weightB, 0, 1);
    const body = a.copy();
    body.nodes = a.nodes.map((node, index) => {
      const other = b.nodes[index];
      return {
        ...node,
        x: node.x * (1 - weight) + other.x * weight,
        y: node.y * (1 - weight) + other.y * weight,
        vx: node.vx * (1 - weight) + other.vx * weight,
        vy: node.vy * (1 - weight) + other.vy * weight,
      };
    });
    body.lift = a.lift * (1 - weight) + b.lift * weight;
    return body;
  }
  setCenter(x: number, y: number) {
    const pose = this.pose();
    const dx = x - pose.x;
    const dy = y - pose.y;
    for (const node of this.nodes) {
      node.x += dx;
      node.y += dy;
    }
    this.fixedCenter = { x, y };
  }
  translate(dx: number, dy: number) {
    if (!dx && !dy) return;
    const pose = this.pose();
    this.setCenter(pose.x + dx, pose.y + dy);
  }
  setFixed(fixed: boolean) {
    if (fixed && !this.fixed) {
      const pose = this.pose();
      this.fixedCenter = { x: pose.x, y: pose.y };
    }
    this.fixed = fixed;
  }
  setVelocity(x: number, y: number) {
    for (const node of this.nodes) {
      node.vx = x;
      node.vy = y;
    }
  }
  meanVelocity(): Point {
    return {
      x: this.nodes.reduce((sum, node) => sum + node.vx, 0) / this.nodes.length,
      y: this.nodes.reduce((sum, node) => sum + node.vy, 0) / this.nodes.length,
    };
  }
  restorePose(target: { x: number; y: number; angle: number }, dt: number) {
    const pose = this.pose();
    if (this.reduced) {
      const response = 1 - Math.exp(-dt * 4.5);
      this.translate(
        (target.x - pose.x) * response,
        (target.y - pose.y) * response,
      );
      return;
    }
    const velocity = this.meanVelocity();
    const stiffness = 18;
    const damping = 8.5;
    this.addForce(
      clamp(
        (target.x - pose.x) * stiffness - velocity.x * damping,
        -6000,
        6000,
      ),
      clamp(
        (target.y - pose.y) * stiffness - velocity.y * damping,
        -6000,
        6000,
      ),
      dt,
    );

    let inertia = 0;
    let angularMomentum = 0;
    for (const node of this.nodes) {
      const x = node.x - pose.x;
      const y = node.y - pose.y;
      inertia += x * x + y * y;
      angularMomentum += x * node.vy - y * node.vx;
    }
    const angularVelocity = inertia ? angularMomentum / inertia : 0;
    const angularAcceleration = clamp(
      angleDelta(target.angle - pose.angle) * stiffness -
        angularVelocity * damping,
      -24,
      24,
    );
    for (const node of this.nodes) {
      const x = node.x - pose.x;
      const y = node.y - pose.y;
      node.vx -= y * angularAcceleration * dt;
      node.vy += x * angularAcceleration * dt;
    }
  }
  addForce(x: number, y: number, dt: number) {
    for (const node of this.nodes) {
      node.vx += x * dt;
      node.vy += y * dt;
    }
  }
  move(point: Point, pointerId = 0) {
    const grab = this.grabs.get(pointerId);
    if (grab)
      grab.target = {
        x: clamp(point.x, 24, this.width - 24),
        y: clamp(point.y, 24, this.height - 24),
      };
  }
  release(pointerId?: number) {
    if (pointerId === undefined) this.grabs.clear();
    else this.grabs.delete(pointerId);
  }
  get grab(): Grab | null {
    return this.grabs.values().next().value ?? null;
  }
  apply(binding: Binding, x: number, y: number, dt: number) {
    const norm = binding.weights.reduce((sum, w) => sum + w * w, 0);
    binding.ids.forEach((id, i) => {
      const share = binding.weights[i] / norm;
      this.nodes[id].x += x * share;
      this.nodes[id].y += y * share;
      this.nodes[id].vx += (x * share) / dt;
      this.nodes[id].vy += (y * share) / dt;
    });
  }
  stop() {
    this.release();
    this.releaseWhole();
    for (const n of this.nodes) {
      n.vx = 0;
      n.vy = 0;
    }
  }
  nudge(x = 1, y = 0) {
    if (this.reduced) {
      for (const n of this.nodes) {
        n.x += x * 20;
        n.y += y * 20;
      }
      this.contain();
      return;
    }
    for (const n of this.nodes) {
      n.vx += x * (280 + (250 * n.ry) / this.size);
      n.vy += y * 280 - ((x * n.rx) / this.size) * 160;
    }
  }
  pose() {
    const x = this.nodes.reduce((sum, n) => sum + n.x, 0) / this.nodes.length;
    const y = this.nodes.reduce((sum, n) => sum + n.y, 0) / this.nodes.length;
    let dot = 0,
      cross = 0;
    for (const n of this.nodes) {
      dot += n.rx * (n.x - x) + n.ry * (n.y - y);
      cross += n.rx * (n.y - y) - n.ry * (n.x - x);
    }
    const angle = Math.atan2(cross, dot),
      c = Math.cos(angle),
      s = Math.sin(angle);
    const deformation = Math.sqrt(
      this.nodes.reduce(
        (sum, n) =>
          sum +
          (n.x - x - c * n.rx + s * n.ry) ** 2 +
          (n.y - y - s * n.rx - c * n.ry) ** 2,
        0,
      ) / this.nodes.length,
    );
    const speed = Math.sqrt(
      this.nodes.reduce((sum, n) => sum + n.vx * n.vx + n.vy * n.vy, 0) /
        this.nodes.length,
    );
    return { x, y, angle, deformation, speed };
  }
  step(dt = STEP) {
    if (this.reduced) {
      const pose = this.pose();
      for (const n of this.nodes) {
        n.x = pose.x + n.rx;
        n.y = pose.y + n.ry;
        n.vx = 0;
        n.vy = 0;
      }
      if (this.grabs.size) {
        let dx = 0,
          dy = 0;
        for (const grab of this.grabs.values()) {
          const pin = this.at(grab.binding);
          dx += grab.target.x - pin.x;
          dy += grab.target.y - pin.y;
        }
        dx /= this.grabs.size;
        dy /= this.grabs.size;
        for (const n of this.nodes) {
          n.x += dx;
          n.y += dy;
        }
      }
      this.contain();
      this.holdFixedCenter();
      this.lift = 0;
      return;
    }
    this.lift +=
      ((this.grabs.size ? 1 : 0) - this.lift) * (1 - Math.exp(-dt * 10));
    const previous = this.nodes.map((n) => ({ x: n.x, y: n.y }));
    const damping = Math.exp(-dt * (this.grabs.size ? 2.5 : 4));
    for (const n of this.nodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx * dt;
      n.y += n.vy * dt + (this.grabs.size ? 150 : 0) * dt * dt;
    }
    for (let iteration = 0; iteration < 5; iteration++) {
      const pose = this.pose();
      const angle = pose.angle * (1 - (dt * (this.grabs.size ? 0.3 : 1.2)) / 5);
      const c = Math.cos(angle),
        s = Math.sin(angle);
      const restore = (1 - Math.exp(-dt * (50 - this.softness * 40))) / 5;
      for (const n of this.nodes) {
        n.x += (pose.x + c * n.rx - s * n.ry - n.x) * restore;
        n.y += (pose.y + s * n.rx + c * n.ry - n.y) * restore;
      }
      for (const link of this.links) {
        const a = this.nodes[link.a],
          b = this.nodes[link.b],
          dx = b.x - a.x,
          dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const correction =
          (((length - link.length) / length) *
            link.strength *
            (1.2 - this.softness * 0.65)) /
          2;
        a.x += dx * correction;
        a.y += dy * correction;
        b.x -= dx * correction;
        b.y -= dy * correction;
      }
      for (const grab of this.grabs.values()) {
        const pin = this.at(grab.binding),
          dx = grab.target.x - pin.x,
          dy = grab.target.y - pin.y;
        const norm = grab.binding.weights.reduce((sum, w) => sum + w * w, 0);
        const limit = Math.min(
          1,
          (this.glyphSize * 0.035) / (Math.hypot(dx, dy) || 1),
        );
        grab.binding.ids.forEach((id, i) => {
          const weight =
            (grab.binding.weights[i] / norm) * this.grabStrength * limit;
          this.nodes[id].x += dx * weight;
          this.nodes[id].y += dy * weight;
        });
      }
    }
    this.contain();
    this.nodes.forEach((n, i) => {
      n.vx = clamp((n.x - previous[i].x) / dt, -1800, 1800);
      n.vy = clamp((n.y - previous[i].y) / dt, -1800, 1800);
      if (Math.abs(n.vx) < 0.01) n.vx = 0;
      if (Math.abs(n.vy) < 0.01) n.vy = 0;
    });
    this.holdFixedCenter();
  }
  private holdFixedCenter() {
    if (!this.fixed) return;
    const pose = this.pose();
    const dx = this.fixedCenter.x - pose.x;
    const dy = this.fixedCenter.y - pose.y;
    const velocity = this.meanVelocity();
    for (const node of this.nodes) {
      node.x += dx;
      node.y += dy;
      node.vx -= velocity.x;
      node.vy -= velocity.y;
    }
    this.contain();
  }
  private contain() {
    for (const n of this.nodes) {
      n.x = clamp(n.x, 12, this.width - 12);
      n.y = clamp(n.y, 12, this.height - 12);
    }
  }
}

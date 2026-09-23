import { test } from "node:test";
import assert from "node:assert/strict";
import { STEP, WobbleBody } from "../src/lib/wobble";

test("a fast pull deforms the ink, carries inertia into a stop, then settles", () => {
  const body = new WobbleBody(1000, 550);
  const start = body.at(body.bind(0.35, 0.3));
  body.start(start);
  for (let i = 0; i < 30; i++) {
    body.move({ x: start.x + i * 6, y: start.y });
    body.step();
  }
  const stopped = body.pose();
  assert.ok(
    stopped.deformation > 1,
    "the character bends, beyond rigid translation",
  );
  assert.ok(stopped.speed > 100);
  for (let i = 0; i < 12; i++) body.step();
  assert.ok(
    Math.hypot(body.pose().x - stopped.x, body.pose().y - stopped.y) > 2,
    "the body keeps moving while the hand is still",
  );
  const pin = body.at(body.grab!.binding);
  assert.ok(
    Math.hypot(pin.x - body.grab!.target.x, pin.y - body.grab!.target.y) < 3,
    "the held point stays attached",
  );
  body.release();
  for (let i = 0; i < 720; i++) body.step();
  assert.ok(body.pose().speed < 0.1);
  assert.ok(body.pose().deformation < 0.1);
});

test("grabbing a deformed body does not relocate the attachment", () => {
  const body = new WobbleBody(1000, 550);
  body.nudge();
  for (let i = 0; i < 10; i++) body.step();
  const point = body.at(body.bind(0.23, 0.43));
  body.start(point);
  const actual = body.at(body.grab!.binding);
  assert.ok(Math.hypot(point.x - actual.x, point.y - actual.y) < 0.1);
});

test("four pointer IDs hold independent points and release independently", () => {
  const body = new WobbleBody(1000, 650);
  const starts = [
    body.at(body.bind(0.12, 0.16)),
    body.at(body.bind(0.38, 0.24)),
    body.at(body.bind(0.68, 0.71)),
    body.at(body.bind(0.88, 0.82)),
  ];
  const ids = [17, 23, 31, 47];
  const bindings = starts.map((point, i) => body.start(point, ids[i]));
  const targets = starts.map((point, i) => ({
    x: point.x + (i % 2 ? -32 : 32),
    y: point.y + (i < 2 ? 22 : -22),
  }));
  targets.forEach((point, i) => body.move(point, ids[i]));
  for (let i = 0; i < 24; i++) body.step();

  assert.equal(body.grabs.size, 4);
  for (let i = 0; i < ids.length; i++) {
    const pin = body.at(bindings[i]);
    assert.ok(
      Math.hypot(pin.x - targets[i].x, pin.y - targets[i].y) < 8,
      `pointer ${ids[i]} stays attached to its own target`,
    );
  }
  body.release(ids[1]);
  assert.equal(body.grabs.size, 3);
  assert.equal(body.grabs.has(ids[1]), false);
  assert.equal(body.grabs.has(ids[0]), true);
  body.release();
  assert.equal(body.grabs.size, 0);
});

test("extreme gestures remain finite and within the board; reset removes momentum", () => {
  const body = new WobbleBody(350, 380);
  body.start(body.at(body.bind(0.3, 0.3)));
  for (let i = 0; i < 500; i++) {
    body.move({ x: i % 2 ? 10000 : -10000, y: i % 3 ? -10000 : 10000 });
    body.step();
    assert.ok(
      body.nodes.every(
        (n) =>
          Number.isFinite(n.x) &&
          Number.isFinite(n.y) &&
          n.x >= 0 &&
          n.x <= body.width &&
          n.y >= 0 &&
          n.y <= body.height,
      ),
    );
  }
  body.reset();
  assert.equal(body.grab, null);
  assert.equal(body.pose().speed, 0);
  assert.ok(Math.abs(body.pose().x - body.width / 2) < 0.001);
});

test("reduced motion follows a drag without wobble or release inertia", () => {
  const body = new WobbleBody(1000, 550);
  body.reduced = true;
  const start = body.at(body.bind(0.4, 0.4));
  body.start(start);
  body.move({ x: start.x + 100, y: start.y + 20 });
  body.step();
  assert.ok(body.pose().deformation < 0.001);
  body.release();
  const pose = body.pose();
  for (let i = 0; i < 120; i++) body.step();
  assert.ok(Math.abs(body.pose().x - pose.x) < 0.001);
  assert.equal(body.pose().speed, 0);
});

test("fixed centroids resist parent pulls while weighted bodies and free parts yield", () => {
  const makeBody = (fixed: boolean, grabStrength: number) => {
    const body = new WobbleBody(1000, 600);
    body.setFixed(fixed);
    body.grabStrength = grabStrength;
    const start = body.at(body.bind(0.34, 0.35));
    body.start(start);
    body.move({ x: start.x + 110, y: start.y + 12 });
    for (let i = 0; i < 40; i++) body.step();
    return body;
  };
  const fixed = makeBody(true, 0.42);
  const weighted = makeBody(false, 0.42);
  const freePart = makeBody(false, 1.25);
  const fixedPose = fixed.pose();
  const weightedPose = weighted.pose();

  assert.ok(Math.abs(fixedPose.x - 500) < 0.001);
  assert.ok(Math.abs(fixedPose.y - 300) < 0.001);
  assert.ok(Math.hypot(weightedPose.x - 500, weightedPose.y - 300) > 1);
  assert.ok(
    freePart.pose().deformation > weightedPose.deformation,
    "the detached piece follows the same pull more readily than its weighted parent",
  );
});

test("released ink returns to its tile center and orientation", () => {
  const target = { x: 500, y: 300, angle: 0 };
  const body = new WobbleBody(1000, 600, 0.42, 0.42);
  body.setCenter(610, 335);
  const center = body.pose();
  const rotation = 0.7;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  for (const node of body.nodes) {
    const x = node.x - center.x;
    const y = node.y - center.y;
    node.x = center.x + cosine * x - sine * y;
    node.y = center.y + sine * x + cosine * y;
  }
  assert.ok(Math.abs(body.pose().angle) > 0.5);

  for (let i = 0; i < 360; i++) {
    body.restorePose(target, STEP);
    body.step();
  }
  const settled = body.pose();
  assert.ok(Math.hypot(settled.x - target.x, settled.y - target.y) < 2);
  assert.ok(Math.abs(settled.angle - target.angle) < 0.03);

  body.reduced = true;
  body.setCenter(600, 330);
  for (let i = 0; i < 120; i++) {
    body.restorePose(target, STEP);
    body.step();
  }
  assert.ok(Math.hypot(body.pose().x - target.x, body.pose().y - target.y) < 2);
  assert.equal(body.pose().speed, 0);
});

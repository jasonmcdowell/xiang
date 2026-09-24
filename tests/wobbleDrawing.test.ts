import { test } from "node:test";
import assert from "node:assert/strict";
import { projectInkPoint } from "../src/lib/wobbleDrawing";
import { WobbleBody } from "../src/lib/wobble";

test("silk ink rests on tile tops, sinks to the table, and rises over another tile", () => {
  const surface = new WobbleBody(600, 600, 0.3, 0.3);
  const body = new WobbleBody(600, 600, 0.36, 0.36);
  const centerBinding = body.bind(0.5, 0.5);
  const rest = body.idealAt(centerBinding);
  const pose = surface.pose();

  const resting = projectInkPoint(rest, surface, body, "silk", rest, pose, [
    surface,
  ]);
  assert.equal(resting.drape, 0);
  assert.deepEqual(resting.point, rest);

  const pulled = { x: pose.x + 220, y: pose.y };
  const onTable = projectInkPoint(pulled, surface, body, "silk", rest, pose, [
    surface,
  ]);
  assert.equal(onTable.drape, 1);
  assert.equal(onTable.point.y, pulled.y + 24);

  const otherTile = new WobbleBody(600, 600, 0.3, 0.3);
  otherTile.setCenter(pulled.x, pulled.y);
  const onOtherTile = projectInkPoint(
    pulled,
    surface,
    body,
    "silk",
    rest,
    pose,
    [surface, otherTile],
  );
  assert.equal(onOtherTile.drape, 0);
  assert.deepEqual(onOtherTile.point, pulled);
});

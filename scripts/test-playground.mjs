import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const browser = await chromium.launch();
const base = process.env.XIANG_TEST_URL || "http://127.0.0.1:3000";
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const state = (target = page) =>
  target.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (target, milliseconds) =>
  target.evaluate((value) => window.advanceTime(value), milliseconds);
const load = async (target = page) => {
  await target.goto(`${base}/playground`);
  await target.waitForFunction(
    () =>
      window.render_game_to_text &&
      JSON.parse(window.render_game_to_text()).ready,
  );
  await advance(target, 0);
};
const screenPoint = (box, point) => ({
  x: box.x + point.x,
  y: box.y + point.y,
});
const assertUniformTiles = (characters, label) => {
  const sizes = characters.map(({ tile }) => [tile.width, tile.height]);
  assert.ok(
    sizes.length &&
      sizes.every(
        ([width, height]) => width === sizes[0][0] && height === sizes[0][1],
      ),
    `${label} characters use the same tile size`,
  );
  assert.ok(
    sizes[0][0] < 220 && sizes[0][0] === sizes[0][1],
    `${label} tile face is compact and square`,
  );
};
const assertNoTileOverlap = (characters, label) => {
  assert.ok(characters.length >= 2, label + " has multiple tiles");
  for (let i = 0; i < characters.length; i++)
    for (let j = i + 1; j < characters.length; j++) {
      const first = characters[i];
      const second = characters[j];
      const x = Math.abs(first.tile.center.x - second.tile.center.x);
      const y = Math.abs(first.tile.center.y - second.tile.center.y);
      assert.ok(
        x >= (first.tile.width + second.tile.width) / 2 - 1e-3 ||
          y >= (first.tile.height + second.tile.height) / 2 - 1e-3,
        label + " faces " + first.char + " and " + second.char + " overlap",
      );
    }
};
const getFaceOverlap = (first, second) => ({
  x:
    (first.tile.width + second.tile.width) / 2 -
    Math.abs(first.tile.center.x - second.tile.center.x),
  y:
    (first.tile.height + second.tile.height) / 2 -
    Math.abs(first.tile.center.y - second.tile.center.y),
});
const dragTileFace = async (target, box, snapshot, character, center) => {
  const tile = snapshot.characters.find((item) => item.char === character);
  assert.ok(tile, `find ${character} tile to drag`);
  const grip = { x: tile.tile.width * 0.4, y: -tile.tile.height * 0.4 };
  const start = {
    x: tile.tile.center.x + grip.x,
    y: tile.tile.center.y + grip.y,
  };
  const end = { x: center.x + grip.x, y: center.y + grip.y };
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.max(4, Math.ceil(distance / 12));
  await target.mouse.move(box.x + start.x, box.y + start.y);
  await target.mouse.down();
  const grabbed = await state(target);
  assert.equal(
    grabbed.activeContacts[0]?.character,
    character,
    `grab the exposed face of ${character}`,
  );
  assert.equal(grabbed.activeContacts[0]?.interaction, "tile");
  for (let i = 1; i <= steps; i++) {
    const amount = i / steps;
    await target.mouse.move(
      box.x + start.x + (end.x - start.x) * amount,
      box.y + start.y + (end.y - start.y) * amount,
    );
    await advance(target, 1000 / 60);
  }
  for (let i = 0; i < 6; i++) await advance(target, 1000 / 60);
  return state(target);
};
const moveHeldTileFace = async (target, box, snapshot, character, center) => {
  const tile = snapshot.characters.find((item) => item.char === character);
  const contact = snapshot.activeContacts.find(
    (item) => item.character === character && item.interaction === "tile",
  );
  assert.ok(tile && contact, `keep holding the ${character} tile face`);
  const start = contact.target;
  const delta = {
    x: center.x - tile.tile.center.x,
    y: center.y - tile.tile.center.y,
  };
  const distance = Math.hypot(delta.x, delta.y);
  const steps = Math.max(4, Math.ceil(distance / 12));
  for (let i = 1; i <= steps; i++) {
    const amount = i / steps;
    await target.mouse.move(
      box.x + start.x + delta.x * amount,
      box.y + start.y + delta.y * amount,
    );
    await advance(target, 1000 / 60);
  }
  for (let i = 0; i < 6; i++) await advance(target, 1000 / 60);
  return state(target);
};
const drag = async (target, box, start, movements, dx, dy = 0) => {
  const origin = screenPoint(box, start);
  await target.mouse.move(origin.x, origin.y);
  await target.mouse.down();
  for (let i = 1; i <= movements; i++) {
    await target.mouse.move(origin.x + i * dx, origin.y + i * dy);
    await advance(target, 1000 / 60);
  }
};
mkdirSync("output/playground", { recursive: true });

try {
  await load();
  let current = await state();
  assert.equal(current.character, "想");
  assert.equal(current.physicsMode, "fixed");
  assert.equal(current.visualStyle, "raised");
  assert.deepEqual(
    ["想", "相", "明", "休", "好"].map((char) => char),
    await page
      .getByRole("button", { name: /^[想相明休好]$/ })
      .allTextContents(),
  );
  const canvas = page.locator("canvas");
  let box = await canvas.boundingBox();
  const home = current.pose;
  const tileHome = current.characters[0].tile.center;
  assertUniformTiles(current.characters, "initial");
  for (const style of ["flat", "raised", "draped"]) {
    await page.locator(`input[name="visual-style"][value="${style}"]`).check();
    await page.waitForFunction(
      (value) => JSON.parse(window.render_game_to_text()).visualStyle === value,
      style,
    );
    await page.screenshot({
      path: `output/playground/surface-${style}.png`,
      fullPage: true,
    });
  }
  await page.locator('input[name="visual-style"][value="draped"]').check();
  current = await state();
  box = await canvas.boundingBox();
  await drag(page, box, current.componentGrabPoints["相"][4], 4, 7, 1);
  current = await state();
  assert.equal(current.visualStyle, "draped");
  assert.equal(current.phase, "stretching");
  assert.deepEqual(
    [current.characters[0].tile.center.x, current.characters[0].tile.center.y],
    [tileHome.x, tileHome.y],
    "pulling on ink keeps the tile in place",
  );
  await page.screenshot({
    path: "output/playground/draped-held.png",
    fullPage: true,
  });
  await page.mouse.up();
  assert.equal((await state()).phase, "whole");
  await page.locator('input[name="visual-style"][value="raised"]').check();
  current = await state();
  box = await canvas.boundingBox();
  await page.screenshot({
    path: "output/playground/lab-rest.png",
    fullPage: true,
  });

  // Bare tile face is a whole-character grip. Fixed pins its center; Weighted moves.
  const tileGrip = { x: tileHome.x - 90, y: tileHome.y };
  await drag(page, box, tileGrip, 4, 6, 4);
  current = await state();
  assert.equal(current.dragging, true);
  assert.equal(current.activeContacts[0].interaction, "tile");
  assert.equal(current.activeContacts[0].component, null);
  assert.ok(Math.abs(current.pose.x - home.x) < 0.1);
  assert.ok(Math.abs(current.pose.y - home.y) < 0.1);
  await page.mouse.up();

  await page.locator('input[name="physics-mode"][value="weighted"]').check();
  current = await state();
  const weightedTileHome = current.characters[0].tile.center;
  box = await canvas.boundingBox();
  await drag(page, box, current.componentGrabPoints["相"][4], 3, 7, 1);
  current = await state();
  assert.equal(current.phase, "stretching");
  assert.deepEqual(
    [current.characters[0].tile.center.x, current.characters[0].tile.center.y],
    [weightedTileHome.x, weightedTileHome.y],
    "weighted ink motion also leaves its tile anchored",
  );
  await page.mouse.up();
  await advance(page, 500);
  current = await state();
  assert.deepEqual(
    [current.characters[0].tile.center.x, current.characters[0].tile.center.y],
    [weightedTileHome.x, weightedTileHome.y],
    "ink inertia does not carry the tile along",
  );

  const weightedHome = current.pose;
  box = await canvas.boundingBox();
  const weightedTileGrip = {
    x: current.characters[0].tile.center.x - 90,
    y: current.characters[0].tile.center.y,
  };
  await drag(page, box, weightedTileGrip, 10, 7, 4);
  current = await state();
  assert.equal(current.physicsMode, "weighted");
  assert.equal(current.activeContacts[0].interaction, "tile");
  assert.equal(current.activeContacts[0].component, null);
  assert.ok(
    Math.hypot(
      current.pose.x - weightedHome.x,
      current.pose.y - weightedHome.y,
    ) > 1,
    "grabbing the blank tile moves the weighted character as a whole",
  );
  assert.ok(
    current.characters[0].center.deformation < 0.1,
    "a whole-tile drag translates the character without bending its strokes",
  );
  assert.ok(
    Math.hypot(
      current.characters[0].tile.center.x - weightedTileHome.x,
      current.characters[0].tile.center.y - weightedTileHome.y,
    ) > 1,
    "the tile moves when its blank face is grabbed",
  );
  await page.screenshot({
    path: "output/playground/weighted-tile-grab.png",
    fullPage: true,
  });
  await page.mouse.up();
  await page.locator('input[name="physics-mode"][value="fixed"]').check();
  await page.getByRole("button", { name: "想", exact: true }).click();
  current = await state();
  box = await canvas.boundingBox();

  // A short fixed-mode tug stretches the ink but releasing it restores one character.
  await drag(page, box, current.componentGrabPoints["相"][4], 3, 7, 1);
  current = await state();
  assert.equal(current.phase, "stretching");
  await page.mouse.up();
  current = await state();
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["想"],
  );
  assert.equal(current.phase, "whole");
  assert.ok(Math.abs(current.pose.x - home.x) < 0.1);
  assert.ok(Math.abs(current.pose.y - home.y) < 0.1);

  // Tear a mapped child, then tear that free child again without losing its sibling.
  await page.getByRole("button", { name: "想", exact: true }).click();
  current = await state();
  box = await canvas.boundingBox();
  const firstTearOrigin = screenPoint(
    box,
    current.componentGrabPoints["相"][4],
  );
  await page.mouse.move(firstTearOrigin.x, firstTearOrigin.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(firstTearOrigin.x + i * 9, firstTearOrigin.y - i);
    await advance(page, 1000 / 60);
  }
  current = await state();
  assert.equal(current.phase, "stretching");
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["想"],
    "the character remains one tile while its child faces would overlap",
  );
  assert.equal(current.tearing.readyForTiles, false);
  assert.match(current.message, /tile faces have room/);
  for (let i = 13; i <= 35 && current.phase === "stretching"; i++) {
    await page.mouse.move(firstTearOrigin.x + i * 9, firstTearOrigin.y - i);
    await advance(page, 1000 / 60);
    current = await state();
  }
  assert.equal(current.phase, "loose");
  assertUniformTiles(current.characters, "decomposed");
  assertNoTileOverlap(current.characters, "first tear");
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["相", "心"],
  );
  assert.equal(current.activeContacts[0].character, "相");
  await page.screenshot({
    path: "output/playground/first-tear.png",
    fullPage: true,
  });
  const freeXiang = current.characters.find((object) => object.char === "相");
  const nestedScale = freeXiang.scale;
  await page.mouse.up();
  const nestedStart = freeXiang.grabPoints[3];
  await drag(page, box, nestedStart, 30, 9, 1);
  current = await state();
  assert.equal(current.phase, "loose");
  assert.deepEqual(
    [...current.characters.map((object) => object.char)].sort(),
    ["心", "木", "目"],
  );
  assertUniformTiles(current.characters, "nested decomposition");
  assertNoTileOverlap(current.characters, "nested tear");
  assert.equal(current.activeContacts[0].character, "木");
  const wood = current.characters.find((object) => object.char === "木");
  const eye = current.characters.find((object) => object.char === "目");
  assert.ok(
    wood.inkCenter.x > eye.inkCenter.x,
    "the pull deliberately put 木 on the wrong side",
  );
  assert.equal(
    current.magnet.active,
    false,
    "separated, wrong-side tile faces do not attract",
  );
  await page.screenshot({
    path: "output/playground/nested-pieces.png",
    fullPage: true,
  });
  await page.mouse.up();
  current = await state();
  let nestedEye = current.characters.find((object) => object.char === "目");
  current = await dragTileFace(page, box, current, "木", {
    x: nestedEye.tile.center.x + 88,
    y: nestedEye.tile.center.y,
  });
  const stillWrongSideWood = current.characters.find(
    (object) => object.char === "木",
  );
  const stillWrongSideEye = current.characters.find(
    (object) => object.char === "目",
  );
  const wrongSideOverlap = getFaceOverlap(
    stillWrongSideWood,
    stillWrongSideEye,
  );
  assert.ok(wrongSideOverlap.x > 0 && wrongSideOverlap.y > 0);
  assert.equal(
    current.magnet.active,
    false,
    "overlapping faces in the reversed 相 layout still do not attract",
  );
  assert.deepEqual(
    [...current.characters.map((object) => object.char)].sort(),
    ["心", "木", "目"],
  );
  await page.mouse.up();
  current = await state();
  nestedEye = current.characters.find((object) => object.char === "目");
  current = await dragTileFace(page, box, current, "木", {
    x: nestedEye.tile.center.x - 88,
    y: nestedEye.tile.center.y,
  });
  if (current.magnet.active) {
    assert.ok(
      current.magnet.targetFrom.x < current.magnet.targetTo.x,
      "the overlapping faces preserve the horizontal 相 layout",
    );
    assert.ok(current.magnet.tileOverlap.x > 0);
    assert.ok(current.magnet.tileOverlap.y > 0);
    assert.ok(Math.abs(current.magnet.parentScale.x - nestedScale.x) < 0.03);
    assert.ok(Math.abs(current.magnet.parentScale.y - nestedScale.y) < 0.03);
  } else {
    assert.ok(current.characters.some((object) => object.char === "相"));
  }
  await page.mouse.up();
  let nestedComposeSteps = 0;
  while (
    !current.characters.some(
      (object) => object.char === "相" || object.char === "想",
    ) &&
    nestedComposeSteps++ < 300
  ) {
    await advance(page, 33);
    current = await state();
  }
  const restoredXiang = current.characters.find(
    (object) => object.char === "相",
  );
  if (restoredXiang) {
    assert.ok(Math.abs(restoredXiang.scale.x - nestedScale.x) < 0.03);
    assert.ok(Math.abs(restoredXiang.scale.y - nestedScale.y) < 0.03);
    assert.deepEqual(
      [...current.characters.map((object) => object.char)].sort(),
      ["心", "相"],
    );
  } else {
    assert.deepEqual(
      current.characters.map((object) => object.char),
      ["想"],
      "the newly reassembled 相 can immediately magnet into 想",
    );
  }
  assertUniformTiles(current.characters, "nested reassembly");
  await page.screenshot({
    path: "output/playground/nested-recomposed.png",
    fullPage: true,
  });
  await page.mouse.up();

  // Horizontal 相 also waits until both tile faces can clear one another.
  await page.getByRole("button", { name: "相", exact: true }).click();
  current = await state();
  box = await canvas.boundingBox();
  const woodOrigin = screenPoint(box, current.componentGrabPoints["木"][2]);
  await page.mouse.move(woodOrigin.x, woodOrigin.y);
  await page.mouse.down();
  for (let i = 1; i <= 40 && current.characters.length === 1; i++) {
    await page.mouse.move(woodOrigin.x + i * 9, woodOrigin.y);
    await advance(page, 1000 / 60);
    current = await state();
  }
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["木", "目"],
  );
  assertNoTileOverlap(current.characters, "horizontal 相 tear");
  assert.equal(
    current.magnet.active,
    false,
    "the wrong-side horizontal arrangement does not attract",
  );
  await page.mouse.up();

  // Reset to 想, wait for tile clearance, then reassemble by gripping 相's tile.
  await page.getByRole("button", { name: "想", exact: true }).click();
  current = await state();
  const originalCenter = current.pose;
  box = await canvas.boundingBox();
  const xiangPoint = current.componentGrabPoints["相"][4];
  const xiangOrigin = screenPoint(box, xiangPoint);
  await page.mouse.move(xiangOrigin.x, xiangOrigin.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(xiangOrigin.x + i * 9, xiangOrigin.y);
    await advance(page, 1000 / 60);
  }
  current = await state();
  assert.equal(current.phase, "stretching");
  assert.equal(current.tearing.readyForTiles, false);
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["想"],
  );
  for (let i = 13; i <= 35 && current.phase === "stretching"; i++) {
    await page.mouse.move(xiangOrigin.x + i * 9, xiangOrigin.y);
    await advance(page, 1000 / 60);
    current = await state();
  }
  assert.equal(current.phase, "loose");
  assertNoTileOverlap(current.characters, "想 tear");
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["相", "心"],
  );
  assert.equal(current.activeContacts[0].character, "相");
  assert.equal(
    current.magnet.active,
    false,
    "compatible strokes do not tug while their tile faces are separate",
  );
  await page.mouse.up();
  current = await state();
  const xiangTileAtTear = current.characters.find(
    (object) => object.char === "相",
  ).tile;
  const heartTileAtTear = current.characters.find(
    (object) => object.char === "心",
  ).tile;
  const tearDirection = Math.sign(
    xiangTileAtTear.center.x - heartTileAtTear.center.x,
  );
  const touchingCenter = {
    x:
      heartTileAtTear.center.x +
      tearDirection * ((xiangTileAtTear.width + heartTileAtTear.width) / 2 + 1),
    y: xiangTileAtTear.center.y,
  };
  current = await dragTileFace(page, box, current, "相", {
    ...touchingCenter,
  });
  assert.equal(
    current.magnet.active,
    false,
    "edge contact alone does not start the magnetic pull",
  );
  const overlappedCenter = {
    ...touchingCenter,
    x: touchingCenter.x - tearDirection * 2,
  };
  current = await moveHeldTileFace(page, box, current, "相", overlappedCenter);
  if (current.magnet.active) {
    const xiangTile = current.characters.find((object) => object.char === "相");
    const heart = current.characters.find((object) => object.char === "心");
    const overlap = getFaceOverlap(xiangTile, heart);
    assert.ok(overlap.x > 0 && overlap.y > 0);
    assert.ok(current.magnet.tileOverlap.x > 0);
    assert.ok(current.magnet.tileOverlap.x < 3);
    assert.ok(current.magnet.tileOverlap.y > 0);
    assert.ok(current.magnet.distance > 12 && current.magnet.distance < 220);
    assert.ok(
      current.magnet.targetFrom.y < current.magnet.targetTo.y,
      "the IDS top/bottom arrangement is preserved",
    );
    const shallowStrength = current.magnet.strength;
    assert.equal(
      current.activeContacts[0].interaction,
      "tile",
      "compatible faces can be held while the strokes tug",
    );
    current = await moveHeldTileFace(page, box, current, "相", {
      x: heartTileAtTear.center.x,
      y: touchingCenter.y,
    });
    if (current.magnet.active) {
      assert.ok(current.magnet.strength > shallowStrength);
      assert.ok(current.magnet.tileOverlap.x > 0);
      assert.ok(current.magnet.tileOverlap.y > 32);
      await page.screenshot({
        path: "output/playground/magnetic-pull.png",
        fullPage: true,
      });
    } else {
      assert.ok(current.characters.some((object) => object.char === "想"));
    }
  } else {
    assert.ok(current.characters.some((object) => object.char === "想"));
  }
  await page.mouse.up();
  current = await state();
  let iterations = 0;
  while (
    !current.characters.some((object) => object.char === "想") &&
    iterations++ < 300
  ) {
    await advance(page, 33);
    current = await state();
  }
  assert.ok(
    current.characters.some((object) => object.char === "想"),
    "compatible pieces snap back into 想",
  );
  const recomposed = current.characters.find((object) => object.char === "想");
  assert.ok(
    Math.hypot(
      recomposed.center.x - originalCenter.x,
      recomposed.center.y - originalCenter.y,
    ) < 35,
  );
  await page.screenshot({
    path: "output/playground/tile-recomposed.png",
    fullPage: true,
  });
  await page.mouse.up();
  await advance(page, 6000);
  assert.equal((await state()).contactCount, 0);

  // A weighted parent gives way under the same light pull; detached pieces remain free.
  await page.locator('input[name="physics-mode"][value="weighted"]').check();
  await page.getByRole("button", { name: "明", exact: true }).click();
  current = await state();
  assert.equal(current.physicsMode, "weighted");
  const weightedStart = current.pose;
  box = await canvas.boundingBox();
  await drag(page, box, current.componentGrabPoints["日"][1], 10, 3);
  current = await state();
  assert.equal(current.phase, "stretching");
  assert.ok(
    Math.hypot(
      current.pose.x - weightedStart.x,
      current.pose.y - weightedStart.y,
    ) > 1,
  );
  await page.mouse.up();
  await page.locator('input[name="physics-mode"][value="fixed"]').check();

  for (const character of ["休", "好"]) {
    await page.getByRole("button", { name: character, exact: true }).click();
    current = await state();
    assert.equal(current.character, character);
    assert.equal(Object.keys(current.componentGrabPoints).length, 2);
  }

  // Released ink returns to its own tile when it is outside a composition field.
  const restoration = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  restoration.on("pageerror", (error) => errors.push(error.message));
  restoration.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await load(restoration);
  await restoration
    .locator('input[name="physics-mode"][value="weighted"]')
    .check();
  let restoredState = await state(restoration);
  const restorationCanvas = restoration.locator("canvas");
  const restorationBox = await restorationCanvas.boundingBox();
  await drag(
    restoration,
    restorationBox,
    restoredState.componentGrabPoints["相"][4],
    25,
    9,
    -1,
  );
  restoredState = await state(restoration);
  assert.deepEqual(
    restoredState.characters.map((object) => object.char),
    ["相", "心"],
  );
  await restoration.mouse.up();
  const xiangTile = restoredState.characters.find(
    (object) => object.char === "相",
  ).tile.center;
  const heartTile = restoredState.characters.find(
    (object) => object.char === "心",
  ).tile.center;
  const awayX = heartTile.x - xiangTile.x;
  const awayY = heartTile.y - xiangTile.y;
  const awayLength = Math.hypot(awayX, awayY) || 1;
  const away = { x: awayX / awayLength, y: awayY / awayLength };
  await drag(
    restoration,
    restorationBox,
    { x: heartTile.x + away.x * 80, y: heartTile.y + away.y * 80 },
    18,
    away.x * 12,
    away.y * 12,
  );
  restoredState = await state(restoration);
  assert.equal(restoredState.activeContacts[0].character, "心");
  assert.equal(restoredState.activeContacts[0].interaction, "tile");
  await restoration.mouse.up();
  await advance(restoration, 2500);
  restoredState = await state(restoration);
  assert.equal(restoredState.magnet.active, false);
  const looseHeart = restoredState.characters.find(
    (object) => object.char === "心",
  );
  const heartTileHome = { ...looseHeart.tile.center };
  const heartGrab = looseHeart.grabPoints.reduce((farthest, point) =>
    Math.hypot(point.x - looseHeart.center.x, point.y - looseHeart.center.y) >
    Math.hypot(
      farthest.x - looseHeart.center.x,
      farthest.y - looseHeart.center.y,
    )
      ? point
      : farthest,
  );
  const radialX = heartGrab.x - looseHeart.center.x;
  const radialY = heartGrab.y - looseHeart.center.y;
  const radialLength = Math.hypot(radialX, radialY) || 1;
  const tangent = {
    x: (-radialY / radialLength) * 8,
    y: (radialX / radialLength) * 8,
  };
  await drag(restoration, restorationBox, heartGrab, 12, tangent.x, tangent.y);
  restoredState = await state(restoration);
  const pulledHeart = restoredState.characters.find(
    (object) => object.char === "心",
  );
  const pulledDistance = Math.hypot(
    pulledHeart.center.x - pulledHeart.tile.center.x,
    pulledHeart.center.y - pulledHeart.tile.center.y,
  );
  const pulledAngle = Math.abs(
    pulledHeart.center.angle - pulledHeart.tile.center.angle,
  );
  assert.ok(pulledDistance > 1);
  assert.ok(pulledAngle > 0.01);
  assert.equal(restoredState.magnet.active, false);
  await restoration.screenshot({
    path: "output/playground/ink-pulled-from-tile.png",
    fullPage: true,
  });
  await restoration.mouse.up();
  await advance(restoration, 1500);
  restoredState = await state(restoration);
  const settledHeart = restoredState.characters.find(
    (object) => object.char === "心",
  );
  assert.ok(
    Math.hypot(
      settledHeart.center.x - settledHeart.tile.center.x,
      settledHeart.center.y - settledHeart.tile.center.y,
    ) <
      pulledDistance * 0.5,
    "a released non-combining character settles back onto its tile",
  );
  assert.ok(
    Math.abs(settledHeart.center.angle - settledHeart.tile.center.angle) <
      pulledAngle,
    "released strokes settle back to the tile orientation",
  );
  assert.ok(
    Math.hypot(
      settledHeart.tile.center.x - heartTileHome.x,
      settledHeart.tile.center.y - heartTileHome.y,
    ) < 0.02,
    "the restoring ink force leaves the tile itself anchored",
  );
  await restoration.screenshot({
    path: "output/playground/ink-returned-to-tile.png",
    fullPage: true,
  });
  await restoration.close();

  // Four simultaneous touch contacts keep independent attachments through the tear.
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  mobile.on("pageerror", (error) => errors.push(error.message));
  mobile.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await load(mobile);
  assert.equal((await state(mobile)).reducedMotion, true);
  await mobile.getByLabel("Reduce motion").uncheck();
  await mobile.waitForFunction(
    () => !JSON.parse(window.render_game_to_text()).reducedMotion,
  );
  const mobileCanvas = mobile.locator("canvas");
  await mobileCanvas.scrollIntoViewIfNeeded();
  const mobileBox = await mobileCanvas.boundingBox();
  current = await state(mobile);
  const cdp = await mobile.context().newCDPSession(mobile);
  const touch = (point, id) => ({
    id,
    x: mobileBox.x + point.x,
    y: mobileBox.y + point.y,
    radiusX: 5,
    radiusY: 5,
    force: 1,
  });
  const first = touch(current.componentGrabPoints["相"][5], 11);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [first],
  });
  let touched = await state(mobile);
  assert.equal(touched.contactCount, 1);
  const second = touch(touched.componentGrabPoints["心"][1], 29);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [first, second],
  });
  touched = await state(mobile);
  assert.equal(touched.contactCount, 2);
  assert.ok(touched.tearing?.tetherCount > 0);
  const third = touch(touched.componentGrabPoints["相"][7], 43);
  const fourth = touch(touched.componentGrabPoints["心"][2], 71);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [first, second, third],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [first, second, third, fourth],
  });
  assert.equal((await state(mobile)).contactCount, 4);
  const initialXiangX = (await state(mobile)).componentPoints["相"].x;
  for (let i = 1; i <= 60 && touched.phase !== "loose"; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { ...first, y: first.y + i * 8 },
        second,
        { ...third, y: third.y + i * 8 },
        fourth,
      ],
    });
    await advance(mobile, 1000 / 60);
  }
  touched = await state(mobile);
  assert.equal(
    touched.phase,
    "loose",
    JSON.stringify({
      message: touched.message,
      tearing: touched.tearing,
      contacts: touched.activeContacts,
      canvas: mobileBox,
    }),
  );
  assert.equal(touched.contactCount, 4);
  assertNoTileOverlap(touched.characters, "multitouch tear");
  assert.deepEqual(
    touched.characters.map((object) => object.char),
    ["相", "心"],
  );
  assert.ok(
    touched.characters.find((object) => object.char === "相").inkCenter.x >
      initialXiangX,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [first],
  });
  assert.equal((await state(mobile)).contactCount, 3);
  await mobile.keyboard.press("Escape");
  assert.equal((await state(mobile)).contactCount, 0);
  await mobile.screenshot({
    path: "output/playground/mobile-torn.png",
    fullPage: true,
  });
  await advance(mobile, 6000);
  const settled = await state(mobile);
  assert.ok(settled.characters.every((object) => object.center.speed < 0.1));
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await mobile.setViewportSize({ width: 500, height: 750 });
  await mobile.waitForTimeout(100);
  assert.equal((await state(mobile)).contactCount, 0);

  // Failed scene data has a retry path.
  const failure = await browser.newPage();
  await failure.route("**/data/playground/scene.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await failure.goto(`${base}/playground`);
  await failure.getByRole("button", { name: "Try again" }).waitFor();
  await failure.unroute("**/data/playground/scene.json");
  await failure.getByRole("button", { name: "Try again" }).click();
  await failure.waitForFunction(
    () =>
      window.render_game_to_text &&
      JSON.parse(window.render_game_to_text()).ready,
  );
  await page.getByRole("link", { name: "Back to the game" }).click();
  await page.getByRole("button", { name: "Split 想", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Playground passed: flat/raised/draped rendering and hit testing, fixed and weighted response, tile-aligned ink restoration, safe early release, recursive tears and scale-preserving reassembly, four simultaneous contacts, tile-overlap-gated magnetic pull/distortion/snap, reversed-layout rejection, reduced motion, resize, loading recovery, and game navigation.",
  );
} finally {
  await browser.close();
}

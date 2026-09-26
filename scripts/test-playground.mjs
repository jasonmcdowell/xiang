import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const browser = await chromium.launch();
const base = process.env.XIANG_TEST_URL || "http://127.0.0.1:3000";
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
const errors = [];
const glyphRequests = new Set();
page.on("request", (request) => {
  const match = request
    .url()
    .match(/\/data\/playground\/glyphs\/([A-F0-9]+)\.json(?:\?|$)/i);
  if (match) glyphRequests.add(match[1].toUpperCase());
});
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
  await target.locator('[aria-label="Character details for 想"]').waitFor();
  await target.waitForFunction(() =>
    document
      .querySelector('[aria-label="Character details for 想"]')
      ?.textContent?.includes("xiǎng"),
  );
};
const installAudioSpy = (target) =>
  target.addInitScript(() => {
    const audioParam = {
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
    window.__tearPopCount = 0;
    window.AudioContext = class {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator() {
        return {
          type: "sine",
          frequency: audioParam,
          connect() {},
          start: () => window.__tearPopCount++,
          stop() {},
        };
      }
      createGain() {
        return { gain: audioParam, connect() {} };
      }
      resume() {
        return Promise.resolve();
      }
    };
  });
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
    sizes[0][0] <= 160 && sizes[0][0] === sizes[0][1],
    `${label} tile face is compact and square`,
  );
  for (const { char, scale } of characters)
    assert.ok(
      Math.abs(scale.x - 0.36) < 0.001 && Math.abs(scale.y - 0.36) < 0.001,
      `${label} ${char} uses the standard ink scale, got ${JSON.stringify(scale)}`,
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
const assertSiblingFacesSeparate = (first, second, label) => {
  const overlap = getFaceOverlap(first, second);
  assert.ok(
    overlap.x <= 0 || overlap.y <= 0,
    `${label}: sibling faces ${first.char} and ${second.char} overlap`,
  );
};
const dragTileFace = async (
  target,
  box,
  snapshot,
  character,
  center,
  objectId = null,
) => {
  const tile = snapshot.characters.find((item) =>
    objectId === null ? item.char === character : item.id === objectId,
  );
  assert.ok(tile, `find ${character} tile to drag`);
  const horizontalGrip = tile.tile.width * 0.4;
  const verticalGrip = tile.tile.height * 0.4;
  const grip = {
    x:
      tile.tile.center.x + horizontalGrip > box.width
        ? -horizontalGrip
        : horizontalGrip,
    y: tile.tile.center.y - verticalGrip < 0 ? verticalGrip : -verticalGrip,
  };
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
const doubleTapTile = async (
  target,
  box,
  snapshot,
  character,
  objectId = null,
) => {
  const tile = snapshot.characters.find((object) =>
    objectId === null ? object.char === character : object.id === objectId,
  );
  assert.ok(tile, `find ${character} tile to double-tap`);
  await target.mouse.click(
    box.x + tile.tile.center.x + tile.tile.width * 0.4,
    box.y + tile.tile.center.y - tile.tile.height * 0.4,
    { clickCount: 2, delay: 10 },
  );
};
const doubleTapStroke = async (
  target,
  box,
  snapshot,
  character,
  objectId = null,
) => {
  const tile = snapshot.characters.find((object) =>
    objectId === null ? object.char === character : object.id === objectId,
  );
  assert.ok(
    tile?.grabPoints.length,
    `find a stroke on ${character} to double-tap`,
  );
  const stroke = tile.grabPoints[0];
  await target.mouse.click(box.x + stroke.x, box.y + stroke.y, {
    clickCount: 2,
    delay: 10,
  });
};
const moveHeldTileFace = async (
  target,
  box,
  snapshot,
  character,
  center,
  objectId = null,
) => {
  const tile = snapshot.characters.find((item) =>
    objectId === null ? item.char === character : item.id === objectId,
  );
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
const dragInkToPoint = async (
  target,
  box,
  snapshot,
  character,
  destination,
  expectedInteraction = "ink",
) => {
  const object = snapshot.characters.find((item) => item.char === character);
  assert.ok(object?.grabPoints.length, `find ${character} ink to drag`);
  const start = object.grabPoints[0];
  const distance = Math.hypot(destination.x - start.x, destination.y - start.y);
  const steps = Math.max(4, Math.ceil(distance / 12));
  await target.mouse.move(box.x + start.x, box.y + start.y);
  await target.mouse.down();
  const grabbed = await state(target);
  assert.equal(grabbed.activeContacts[0]?.character, character);
  assert.equal(grabbed.activeContacts[0]?.interaction, expectedInteraction);
  for (let i = 1; i <= steps; i++) {
    const amount = i / steps;
    await target.mouse.move(
      box.x + start.x + (destination.x - start.x) * amount,
      box.y + start.y + (destination.y - start.y) * amount,
    );
    await advance(target, 1000 / 60);
  }
  for (let i = 0; i < 6; i++) await advance(target, 1000 / 60);
  return state(target);
};
const tearComponent = async (target, box, snapshot, character, part) => {
  const parent = snapshot.characters.find(
    (object) => object.char === character,
  );
  assert.ok(parent && snapshot.componentGrabPoints?.[part]?.length);
  const start = snapshot.componentGrabPoints[part][0];
  let dx = start.x - parent.center.x;
  let dy = start.y - parent.center.y;
  const length = Math.hypot(dx, dy) || 1;
  dx = (dx / length) * 8;
  dy = (dy / length) * 8;
  const origin = screenPoint(box, start);
  await target.mouse.move(origin.x, origin.y);
  await target.mouse.down();
  let current = snapshot;
  let stretched = false;
  for (let i = 1; i <= 90 && !(stretched && current.phase === "loose"); i++) {
    await target.mouse.move(origin.x + dx * i, origin.y + dy * i);
    await advance(target, 1000 / 60);
    current = await state(target);
    stretched ||= current.phase === "stretching";
  }
  assert.ok(stretched, `start a tear of ${part} from ${character}`);
  assert.equal(
    current.phase,
    "loose",
    `finish a tear of ${part} from ${character}`,
  );
  return current;
};
const guideHeldTileToMagnet = async (
  target,
  box,
  snapshot,
  movingId,
  parent,
) => {
  let current = snapshot;
  for (let i = 0; i < 100; i++) {
    if (current.characters.some((object) => object.char === parent))
      return current;
    const moving = current.characters.find((object) => object.id === movingId);
    const magnet = current.magnet;
    if (!moving || !magnet.active) return current;
    const fromDistance = Math.hypot(
      moving.inkCenter.x - magnet.from.x,
      moving.inkCenter.y - magnet.from.y,
    );
    const source =
      fromDistance <
      Math.hypot(
        moving.inkCenter.x - magnet.to.x,
        moving.inkCenter.y - magnet.to.y,
      )
        ? magnet.from
        : magnet.to;
    const destination =
      source === magnet.from ? magnet.targetFrom : magnet.targetTo;
    const dx = destination.x - source.x;
    const dy = destination.y - source.y;
    if (Math.hypot(dx, dy) < 2) {
      await advance(target, 1000 / 60);
      current = await state(target);
      continue;
    }
    current = await moveHeldTileFace(
      target,
      box,
      current,
      moving.char,
      {
        x: moving.tile.center.x + dx * 0.45,
        y: moving.tile.center.y + dy * 0.45,
      },
      movingId,
    );
  }
  return current;
};
const guideHeldHeartIntoPlace = async (target, box, initialState) => {
  let current = initialState;
  for (let i = 0; i < 300; i++) {
    if (current.characters.some((object) => object.char === "想"))
      return current;
    const magnet = current.magnet;
    const contact = current.activeContacts.find(
      (item) =>
        item.character === "心" &&
        (item.interaction === "ink" || item.interaction === "tile"),
    );
    if (magnet.active && contact) {
      const dx = magnet.targetTo.x - magnet.to.x;
      const dy = magnet.targetTo.y - magnet.to.y;
      const length = Math.hypot(dx, dy) || 1;
      const distance = Math.min(8, length * 0.24);
      await target.mouse.move(
        box.x + contact.target.x + (dx / length) * distance,
        box.y + contact.target.y + (dy / length) * distance,
      );
    }
    await advance(target, 1000 / 60);
    current = await state(target);
  }
  return current;
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
const assertTilesInsideBoard = (characters, board, label) => {
  for (const { char, tile } of characters) {
    assert.ok(
      tile.center.x >= tile.width / 2 - 1 &&
        tile.center.x <= board.width - tile.width / 2 + 1 &&
        tile.center.y >= tile.height / 2 - 1 &&
        tile.center.y <= board.height - tile.height / 2 + 1,
      `${label}: ${char} stays fully on the board`,
    );
  }
};
mkdirSync("output/playground", { recursive: true });

try {
  await load();
  let current = await state();
  let box;
  assert.equal(current.character, "想");
  assert.equal(current.boardPreset, "starters");
  assert.equal(current.physicsMode, "weighted");
  assert.equal(current.visualStyle, "raised");
  assert.equal(
    await page
      .locator('input[name="physics-mode"][value="weighted"]')
      .isChecked(),
    true,
    "Weighted mode is selected when the Playground opens",
  );
  const initialDetails = await page
    .locator('[aria-label="Character details for 想"]')
    .innerText();
  assert.match(initialDetails, /xiǎng/);
  assert.match(initialDetails, /believe|wish/i);
  box = await page.locator("canvas").boundingBox();
  const initialTileCenter = current.characters[0].tile.center;
  current = await dragTileFace(page, box, current, "想", {
    x: initialTileCenter.x + 18,
    y: initialTileCenter.y + 12,
  });
  assert.ok(
    Math.hypot(
      current.characters[0].tile.center.x - initialTileCenter.x,
      current.characters[0].tile.center.y - initialTileCenter.y,
    ) > 1,
    "an intact character can move immediately by dragging its tile face",
  );
  await page.mouse.up();
  await page.getByRole("button", { name: "Five starters" }).click();
  current = await state();
  assert.equal(current.physicsMode, "weighted");
  const repulsionControl = page.getByRole("checkbox", {
    name: /Tile repulsion/,
  });
  assert.equal(await repulsionControl.isChecked(), true);
  await repulsionControl.uncheck();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).tileRepulsion === false,
  );
  const stickyFocusBox = await page
    .locator('[aria-label="Character details for 想"]')
    .boundingBox();
  assert.ok(
    stickyFocusBox &&
      stickyFocusBox.y >= 0 &&
      stickyFocusBox.y + stickyFocusBox.height <= 1000,
    "the focused dictionary card stays visible while scrolling the side panel",
  );
  await repulsionControl.check();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).tileRepulsion === true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.equal(
    await page.getByText("A LITTLE EXPERIMENT IN FEELING").count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("tabpanel", { name: "Playground" })
      .count(),
    1,
  );
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["想", "相", "明", "休", "好"],
    "the playground starts with five decomposable characters",
  );
  assert.ok(current.loadedRecipeCount >= 5 && current.loadedRecipeCount < 32);
  assert.ok(
    ["木", "目", "日", "月", "子"].every((character) =>
      current.loadedRecipeCharacters.includes(character),
    ),
    "preload the eligible next-step recipes for the starter characters",
  );
  assert.ok(
    current.loadedGlyphCount <= 24 && glyphRequests.size <= 24,
    `the starter board should fetch only its one-step neighborhood, got ${current.loadedGlyphCount} glyphs / ${glyphRequests.size} requests`,
  );
  assert.equal(current.loadedGlyphCount < 100, true);
  assertNoTileOverlap(current.characters, "five starter board");
  assertUniformTiles(current.characters, "five starter board");
  assert.equal(current.characters[0].tile.width, 156);

  const tearSoundPage = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  tearSoundPage.on("pageerror", (error) => errors.push(error.message));
  tearSoundPage.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await installAudioSpy(tearSoundPage);
  await load(tearSoundPage);
  const tearSoundToggle = tearSoundPage.getByRole("checkbox", {
    name: "Pop sound when a component tears free",
  });
  assert.equal(await tearSoundToggle.isChecked(), true);
  let tearSoundBox = await tearSoundPage.locator("canvas").boundingBox();
  let tearSoundState = await state(tearSoundPage);
  await tearComponent(tearSoundPage, tearSoundBox, tearSoundState, "想", "心");
  assert.ok(
    await tearSoundPage.evaluate(() => window.__tearPopCount > 0),
    "a successful tear plays the pop when the option is enabled",
  );
  await tearSoundPage.mouse.up();
  await tearSoundPage.getByRole("button", { name: "Five starters" }).click();
  await tearSoundPage.waitForFunction(() => {
    const game = JSON.parse(window.render_game_to_text());
    return game.characters.length === 5 && game.characters[0].char === "想";
  });
  await tearSoundToggle.uncheck();
  tearSoundBox = await tearSoundPage.locator("canvas").boundingBox();
  tearSoundState = await state(tearSoundPage);
  const popCountBeforeSilentTear = await tearSoundPage.evaluate(
    () => window.__tearPopCount,
  );
  await tearComponent(tearSoundPage, tearSoundBox, tearSoundState, "想", "心");
  assert.equal(
    await tearSoundPage.evaluate(() => window.__tearPopCount),
    popCountBeforeSilentTear,
    "a successful tear stays silent when the option is disabled",
  );
  await tearSoundPage.mouse.up();
  await tearSoundPage.close();

  const doubleTapLab = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  doubleTapLab.on("pageerror", (error) => errors.push(error.message));
  doubleTapLab.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await load(doubleTapLab);
  let doubleTapBox = await doubleTapLab.locator("canvas").boundingBox();
  let doubleTapState = await state(doubleTapLab);
  const doubleTapRepulsion = doubleTapLab.getByRole("checkbox", {
    name: /Tile repulsion/,
  });
  await doubleTapRepulsion.uncheck();
  await doubleTapLab.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).tileRepulsion === false,
  );
  await doubleTapLab.evaluate(() => window.scrollTo(0, 0));
  doubleTapState = await state(doubleTapLab);
  doubleTapBox = await doubleTapLab.locator("canvas").boundingBox();
  await doubleTapStroke(doubleTapLab, doubleTapBox, doubleTapState, "想");
  await doubleTapLab.waitForFunction(() => {
    const game = JSON.parse(window.render_game_to_text());
    return (
      game.characters.length === 6 &&
      game.characters.some((object) => object.char === "相") &&
      game.characters.some((object) => object.char === "心")
    );
  });
  doubleTapState = await state(doubleTapLab);
  assert.ok(!doubleTapState.characters.some((object) => object.char === "想"));
  assertNoTileOverlap(doubleTapState.characters, "double-tapped 想 split");
  assertUniformTiles(doubleTapState.characters, "double-tapped 想 split");
  const separatedPair = [
    doubleTapState.characters.find(
      (object) => object.char === "相" && object.free,
    ),
    doubleTapState.characters.find(
      (object) => object.char === "心" && object.free,
    ),
  ];
  assert.ok(separatedPair[0] && separatedPair[1]);
  const distanceBeforeRepulsion = Math.hypot(
    separatedPair[0].tile.center.x - separatedPair[1].tile.center.x,
    separatedPair[0].tile.center.y - separatedPair[1].tile.center.y,
  );
  await doubleTapRepulsion.check();
  await doubleTapLab.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).tileRepulsion === true,
  );
  await advance(doubleTapLab, 2000);
  doubleTapState = await state(doubleTapLab);
  const repelledPair = [
    doubleTapState.characters.find(
      (object) => object.char === "相" && object.free,
    ),
    doubleTapState.characters.find(
      (object) => object.char === "心" && object.free,
    ),
  ];
  assert.ok(repelledPair[0] && repelledPair[1]);
  const distanceAfterRepulsion = Math.hypot(
    repelledPair[0].tile.center.x - repelledPair[1].tile.center.x,
    repelledPair[0].tile.center.y - repelledPair[1].tile.center.y,
  );
  assert.ok(
    distanceAfterRepulsion > distanceBeforeRepulsion + 1,
    `close loose tiles nudge apart (${distanceBeforeRepulsion} → ${distanceAfterRepulsion})`,
  );
  await doubleTapLab.evaluate(() => window.scrollTo(0, 0));
  doubleTapBox = await doubleTapLab.locator("canvas").boundingBox();
  await doubleTapLab.waitForFunction(() =>
    JSON.parse(window.render_game_to_text()).loadedRecipeCharacters.includes(
      "相",
    ),
  );
  const nestedFreeXiang = doubleTapState.characters.find(
    (object) => object.char === "相" && object.free,
  );
  assert.ok(nestedFreeXiang);
  await doubleTapTile(
    doubleTapLab,
    doubleTapBox,
    doubleTapState,
    "相",
    nestedFreeXiang.id,
  );
  await doubleTapLab.waitForFunction(() => {
    const game = JSON.parse(window.render_game_to_text());
    return (
      game.characters.length === 7 &&
      game.characters.filter((object) => object.char === "相").length === 1 &&
      game.characters.some((object) => object.char === "木") &&
      game.characters.some((object) => object.char === "目") &&
      game.characters.some((object) => object.char === "心")
    );
  });
  doubleTapState = await state(doubleTapLab);
  assertNoTileOverlap(doubleTapState.characters, "nested double-tap split");
  assertUniformTiles(doubleTapState.characters, "nested double-tap split");
  assert.match(
    await doubleTapLab
      .locator('[aria-label^="Character details for "]')
      .getAttribute("aria-label"),
    /^Character details for (木|目)$/,
  );
  await doubleTapLab.screenshot({
    path: "output/playground/double-tap-unfold.png",
    fullPage: true,
  });
  await doubleTapLab.close();

  assert.deepEqual(
    ["想", "相", "明", "休", "好", "林", "森"].map((char) => char),
    await page
      .getByRole("button", { name: /^[想相明休好林森]$/ })
      .allTextContents(),
  );
  const hskPage = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  const hskGlyphRequests = new Set();
  hskPage.on("pageerror", (error) => errors.push(error.message));
  hskPage.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  hskPage.on("request", (request) => {
    const match = request
      .url()
      .match(/\/data\/playground\/glyphs\/([A-F0-9]+)\.json(?:\?|$)/i);
    if (match) hskGlyphRequests.add(match[1].toUpperCase());
  });
  await load(hskPage);
  await hskPage.getByRole("button", { name: "HSK 1 character set" }).click();
  await hskPage.getByRole("button", { name: "Add 学 from HSK 1" }).waitFor();
  assert.equal(await hskPage.getByText("178 drawable characters").count(), 1);
  await hskPage.getByRole("button", { name: "Add 学 from HSK 1" }).click();
  await hskPage.waitForFunction(() => {
    const game = JSON.parse(window.render_game_to_text());
    return game.boardPreset === "custom" && game.characters.length === 6;
  });
  let hskState = await state(hskPage);
  assert.ok(
    hskState.characters.some((object) => object.char === "学"),
    "a Simplified HSK 1 pick adds to the current board",
  );
  assertNoTileOverlap(hskState.characters, "Simplified HSK 1 addition");
  assert.ok(hskGlyphRequests.has("5B66"), "load 学's outline on demand");

  await hskPage.getByRole("button", { name: "Traditional" }).click();
  await hskPage
    .getByText("188 drawable characters · 10 without stroke outlines")
    .waitFor();
  await hskPage.getByRole("button", { name: "Add 學 from HSK 1" }).click();
  await hskPage.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).characters.length === 7,
  );
  hskState = await state(hskPage);
  assert.ok(
    hskState.characters.some((object) => object.char === "學"),
    "a Traditional HSK 1 pick adds without replacing the Simplified pick",
  );
  assertNoTileOverlap(hskState.characters, "Traditional HSK 1 addition");
  assert.ok(hskGlyphRequests.has("5B78"), "load 學's outline on demand");
  await hskPage.screenshot({
    path: "output/playground/hsk1-picker.png",
    fullPage: true,
  });
  await hskPage.close();

  await page.getByLabel("Any dictionary character").fill("信");
  await page.getByRole("button", { name: "Add to board" }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(window.render_game_to_text()).boardPreset === "custom" &&
      JSON.parse(window.render_game_to_text()).characters.length === 6,
  );
  current = await state();
  assert.deepEqual(
    current.characters.map((object) => object.char).sort(),
    ["休", "好", "信", "想", "明", "相"].sort(),
    "adding a dictionary character preserves the existing starter board",
  );
  assertNoTileOverlap(current.characters, "custom six-character board");
  assert.ok(
    glyphRequests.has("4FE1"),
    "fetch an added character outline on demand",
  );
  assert.ok(
    glyphRequests.has("8A00"),
    "fetch the added character's child outline",
  );
  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).characters.length === 6,
  );
  current = await state();
  assert.equal(current.boardPreset, "custom");
  assert.deepEqual(
    current.characters.map((object) => object.char).sort(),
    ["休", "好", "信", "想", "明", "相"].sort(),
    "reset restores the custom board's original characters",
  );

  await page.getByLabel("Any dictionary character").fill("信");
  await page.getByRole("button", { name: "Explore" }).click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).character === "信",
  );
  current = await state();
  assert.equal(current.characters[0].decomposable, true);
  assert.ok(current.loadedGlyphCount <= 32);
  assert.ok(
    glyphRequests.has("4FE1"),
    "fetch the requested 信 outline on demand",
  );
  assert.ok(glyphRequests.has("8A00"), "fetch 信's child 言 outline on demand");
  const arbitraryBox = await page.locator("canvas").boundingBox();
  current = await tearComponent(page, arbitraryBox, current, "信", "人");
  await page.mouse.up();
  current = await state();
  assert.deepEqual(
    current.characters.map((object) => object.char).sort(),
    ["人", "言"],
    "a dynamically loaded dictionary character uses its precise tear mapping",
  );
  await page.locator('[aria-label="Character details for 人"]').waitFor();
  const tornDetails = await page
    .locator('[aria-label="Character details for 人"]')
    .innerText();
  assert.match(tornDetails, /rén/);
  assert.match(tornDetails, /person|people/i);
  const terminalPiece = current.characters.find(
    (object) => object.char === "人",
  );
  const terminalSibling = current.characters.find(
    (object) => object.char === "言",
  );
  assert.equal(terminalPiece.decomposable, false);
  const terminalTileHome = { ...terminalPiece.tile.center };
  const terminalInkOffset = {
    x: terminalPiece.center.x - terminalTileHome.x,
    y: terminalPiece.center.y - terminalTileHome.y,
  };
  const awayFromSibling = {
    x: terminalTileHome.x - terminalSibling.tile.center.x,
    y: terminalTileHome.y - terminalSibling.tile.center.y,
  };
  const siblingDistance = Math.hypot(awayFromSibling.x, awayFromSibling.y) || 1;
  awayFromSibling.x /= siblingDistance;
  awayFromSibling.y /= siblingDistance;
  const personInkGrip = terminalPiece.grabPoints[0];
  await page.mouse.move(box.x + personInkGrip.x, box.y + personInkGrip.y);
  await page.mouse.down();
  current = await state();
  assert.equal(
    current.activeContacts[0]?.interaction,
    "tile",
    "a detached piece without its own recipe uses a whole-tile ink grip",
  );
  await page.mouse.move(
    box.x + personInkGrip.x + awayFromSibling.x * 32,
    box.y + personInkGrip.y + awayFromSibling.y * 32,
  );
  await advance(page, 1000 / 60);
  current = await state();
  const movedPerson = current.characters.find((object) => object.char === "人");
  assert.ok(
    Math.hypot(
      movedPerson.tile.center.x - terminalTileHome.x,
      movedPerson.tile.center.y - terminalTileHome.y,
    ) > 1,
    "grabbing a detached terminal stroke moves its tile",
  );
  assert.ok(
    Math.hypot(
      movedPerson.center.x - movedPerson.tile.center.x - terminalInkOffset.x,
      movedPerson.center.y - movedPerson.tile.center.y - terminalInkOffset.y,
    ) < 2,
    "a detached terminal stroke stays attached to its tile",
  );
  await page.mouse.up();
  await page.getByLabel("Any dictionary character").fill("一");
  await page.getByRole("button", { name: "Explore" }).click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).character === "一",
  );
  current = await state();
  assert.equal(current.characters[0].decomposable, false);
  assert.match(current.message, /no complete physical component mapping/i);
  assert.ok(
    glyphRequests.has("4E00"),
    "fetch a drawable character without a tear recipe",
  );
  await page.getByLabel("Any dictionary character").fill("女");
  await page.getByRole("button", { name: "Explore" }).click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).character === "女",
  );
  current = await state();
  assert.equal(current.characters[0].decomposable, false);
  await page.locator('input[name="physics-mode"][value="weighted"]').check();
  box = await page.locator("canvas").boundingBox();
  for (const style of ["flat", "raised", "draped", "silk"]) {
    await page.locator(`input[name="visual-style"][value="${style}"]`).check();
    current = await state();
    const woman = current.characters[0];
    const womanInkGrip = woman.grabPoints[0];
    const womanTileHome = { ...woman.tile.center };
    const inkOffsetHome = {
      x: woman.center.x - womanTileHome.x,
      y: woman.center.y - womanTileHome.y,
    };
    await page.mouse.move(box.x + womanInkGrip.x, box.y + womanInkGrip.y);
    await page.mouse.down();
    current = await state();
    assert.equal(
      current.activeContacts[0]?.interaction,
      "tile",
      `ink on a non-decomposable 女 grabs the whole tile in ${style} style`,
    );
    await page.mouse.move(
      box.x + womanInkGrip.x + 32,
      box.y + womanInkGrip.y + 18,
    );
    await advance(page, 1000 / 60);
    current = await state();
    const movedWoman = current.characters[0];
    assert.ok(
      Math.hypot(
        movedWoman.tile.center.x - womanTileHome.x,
        movedWoman.tile.center.y - womanTileHome.y,
      ) > 1,
      `dragging 女 ink moves its tile in ${style} style`,
    );
    assert.ok(
      Math.hypot(
        movedWoman.center.x - movedWoman.tile.center.x - inkOffsetHome.x,
        movedWoman.center.y - movedWoman.tile.center.y - inkOffsetHome.y,
      ) < 2,
      `dragging 女 ink keeps it attached to its tile in ${style} style`,
    );
    await page.mouse.up();
  }
  await page.locator('input[name="visual-style"][value="raised"]').check();
  await page.locator('input[name="physics-mode"][value="fixed"]').check();
  await page.getByRole("button", { name: "林", exact: true }).click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).character === "林",
  );
  current = await state();
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["林"],
  );
  await page.getByRole("button", { name: "森", exact: true }).click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).character === "森",
  );
  current = await state();
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["森"],
  );
  assert.ok(current.componentGrabPoints["木"]?.length);
  assert.ok(current.componentGrabPoints["林"]?.length);
  await page.getByRole("button", { name: "Five starters" }).click();
  current = await state();
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["想", "相", "明", "休", "好"],
    "the new single-character experiments preserve the five-tile starter board",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  const canvas = page.locator("canvas");
  box = await canvas.boundingBox();
  assert.ok(
    box.height >= 780,
    "the desktop gameboard uses more vertical space",
  );
  assertTilesInsideBoard(current.characters, box, "five starter board");
  const heartStart = screenPoint(box, current.componentGrabPoints["心"][0]);
  await page.mouse.move(heartStart.x, heartStart.y);
  await page.mouse.down();
  current = await state();
  assert.equal(current.phase, "stretching");
  assert.equal(current.tearing.tetherCount, 0);
  const stationaryRestCenter = { ...current.tearing.restCenter };
  const stationaryRestInkCenter = { ...current.tearing.restInkCenter };
  const stationarySourceTileCenter = { ...current.tearing.sourceTileCenter };
  let tearStep = 0;
  for (let i = 1; i <= 50 && current.phase !== "loose"; i++) {
    await page.mouse.move(heartStart.x, heartStart.y + i * 9);
    await advance(page, 1000 / 60);
    current = await state();
    tearStep = i;
    if (current.tearing) {
      assert.equal(current.tearing.tetherCount, 0);
      for (const [actual, expected, label] of [
        [current.tearing.restCenter, stationaryRestCenter, "remainder body"],
        [
          current.tearing.restInkCenter,
          stationaryRestInkCenter,
          "remainder ink",
        ],
        [
          current.tearing.sourceTileCenter,
          stationarySourceTileCenter,
          "source tile",
        ],
      ])
        assert.ok(
          Math.hypot(actual.x - expected.x, actual.y - expected.y) < 0.1,
          `pulling one component leaves the ${label} stationary`,
        );
    }
  }
  assert.equal(current.phase, "loose");
  assert.ok(tearStep <= 50, "the child tile appears once it clears its source");
  assert.equal(current.boardPreset, "starters");
  assert.equal(current.characters.length, 6);
  assert.deepEqual(
    [...current.characters.map((object) => object.char)].sort(),
    ["休", "好", "心", "明", "相", "相"],
  );
  const heldHeartAtSplit = current.characters.find(
    (object) => object.char === "心" && object.free,
  );
  const stationaryXiangAtSplit = current.characters.find(
    (object) => object.char === "相" && object.free,
  );
  assertSiblingFacesSeparate(
    heldHeartAtSplit,
    stationaryXiangAtSplit,
    "five starter tear siblings",
  );
  assertUniformTiles(current.characters, "five starter tear");
  assertTilesInsideBoard(current.characters, box, "five starter tear");
  const heartAtTear = current.characters.find((object) => object.char === "心");
  const tileCenterAtTear = heartAtTear.tile.center;
  const inkCenterAtTear = heartAtTear.inkCenter;
  await page.mouse.move(heartStart.x, heartStart.y + 240);
  for (let i = 0; i < 18; i++) await advance(page, 1000 / 60);
  current = await state();
  const heldHeart = current.characters.find((object) => object.char === "心");
  assert.ok(
    Math.hypot(
      heldHeart.tile.center.x - tileCenterAtTear.x,
      heldHeart.tile.center.y - tileCenterAtTear.y,
    ) > 12,
    "the new tile moves after the tear while the ink remains held",
  );
  assert.ok(
    Math.hypot(
      heldHeart.tile.center.x - heldHeart.inkCenter.x,
      heldHeart.tile.center.y - heldHeart.inkCenter.y,
    ) < 30,
    "the new tile follows its component while the ink remains held",
  );
  assert.ok(
    Math.hypot(
      heldHeart.inkCenter.x - inkCenterAtTear.x,
      heldHeart.inkCenter.y - inkCenterAtTear.y,
    ) > 12,
    "the held strokes continue moving after the tear",
  );
  const stationaryTileStart = { ...heldHeart.tile.center };
  let maximumStationaryTileDrift = 0;
  for (let i = 0; i < 60; i++) {
    await advance(page, 1000 / 60);
    current = await state();
    const stationaryHeart = current.characters.find(
      (object) => object.char === "心",
    );
    maximumStationaryTileDrift = Math.max(
      maximumStationaryTileDrift,
      Math.hypot(
        stationaryHeart.tile.center.x - stationaryTileStart.x,
        stationaryHeart.tile.center.y - stationaryTileStart.y,
      ),
    );
  }
  assert.ok(
    maximumStationaryTileDrift < 32,
    `the tile stays calm during a stationary hold (max drift ${maximumStationaryTileDrift.toFixed(1)}px)`,
  );
  await page.screenshot({
    path: "output/playground/five-starter-tear.png",
    fullPage: false,
  });
  await page.mouse.up();
  current = await state();
  const heartAtRelease = current.characters.find(
    (object) => object.char === "心",
  );
  assert.ok(heartAtRelease, "the released tile remains in the scene");
  const tileCenterAtRelease = heartAtRelease.tile.center;
  await advance(page, 1000 / 60);
  const heartAfterRelease = (await state()).characters.find(
    (object) => object.char === "心",
  );
  assert.ok(heartAfterRelease, "the tile remains after the next physics step");
  assert.ok(
    Math.hypot(
      heartAfterRelease.tile.center.x - tileCenterAtRelease.x,
      heartAfterRelease.tile.center.y - tileCenterAtRelease.y,
    ) < 0.02,
    "the tile stays where the ink was released",
  );
  await page.getByRole("button", { name: "Five starters" }).click();
  current = await state();
  assert.equal(current.characters.length, 5);
  assertNoTileOverlap(current.characters, "restored five starter board");
  for (const style of ["flat", "raised", "draped", "silk"]) {
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
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForFunction(
    () => document.querySelector("canvas")?.clientWidth > 1000,
  );
  box = await canvas.boundingBox();
  await page.getByRole("button", { name: "想", exact: true }).click();
  current = await state();
  assert.equal(current.boardPreset, "single");
  assert.deepEqual(
    current.characters.map((object) => object.char),
    ["想"],
  );
  const home = current.pose;
  const tileHome = current.characters[0].tile.center;
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
  await page.locator('input[name="visual-style"][value="silk"]').check();
  current = await state();
  box = await canvas.boundingBox();
  await drag(page, box, current.componentGrabPoints["相"][4], 5, 9, 1);
  current = await state();
  assert.equal(current.visualStyle, "silk");
  assert.equal(current.phase, "stretching");
  assert.equal(
    current.activeContacts[0]?.interaction,
    "component",
    "silk projection preserves ink hit testing during a pull",
  );
  assert.deepEqual(
    [current.characters[0].tile.center.x, current.characters[0].tile.center.y],
    [tileHome.x, tileHome.y],
    "silk ink pulling leaves the source tile in place",
  );
  await page.screenshot({
    path: "output/playground/silk-held.png",
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
  const tileGrip = { x: tileHome.x - 70, y: tileHome.y };
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
    x: current.characters[0].tile.center.x - 70,
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
  current = await state();
  assert.equal(current.phase, "stretching");
  const initialRestCenter = { ...current.tearing.restCenter };
  const initialRestInk = { ...current.tearing.restInkCenter };
  for (let i = 1; i <= 50 && current.phase === "stretching"; i++) {
    await page.mouse.move(firstTearOrigin.x + i * 9, firstTearOrigin.y - i);
    await advance(page, 1000 / 60);
    current = await state();
    if (current.tearing) {
      assert.equal(current.tearing.tetherCount, 0);
      assert.ok(
        Math.hypot(
          current.tearing.restCenter.x - initialRestCenter.x,
          current.tearing.restCenter.y - initialRestCenter.y,
        ) < 0.1,
        "the unpulled body stays anchored during a component pull",
      );
      assert.ok(
        Math.hypot(
          current.tearing.restInkCenter.x - initialRestInk.x,
          current.tearing.restInkCenter.y - initialRestInk.y,
        ) < 0.1,
        "the unpulled strokes do not follow the dragged component",
      );
    }
  }
  assert.equal(current.phase, "loose");
  assertUniformTiles(current.characters, "decomposed");
  assertSiblingFacesSeparate(
    current.characters.find((object) => object.char === "相"),
    current.characters.find((object) => object.char === "心"),
    "first tear siblings",
  );
  assertTilesInsideBoard(current.characters, box, "first tear");
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
  for (let i = 31; i <= 80 && current.phase === "stretching"; i++) {
    await page.mouse.move(
      box.x + nestedStart.x + i * 9,
      box.y + nestedStart.y + i,
    );
    await advance(page, 1000 / 60);
    current = await state();
  }
  assert.equal(current.phase, "loose");
  assert.deepEqual(
    [...current.characters.map((object) => object.char)].sort(),
    ["心", "木", "目"],
  );
  assertUniformTiles(current.characters, "nested decomposition");
  assertSiblingFacesSeparate(
    current.characters.find((object) => object.char === "木"),
    current.characters.find((object) => object.char === "目"),
    "nested tear siblings",
  );
  assertTilesInsideBoard(current.characters, box, "nested tear");
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
    fullPage: false,
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
  if (current.magnet.active && current.magnet.parent === "相") {
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

  // A terminal component's stroke grip carries its tile into the sibling for recombination.
  const inkReassembly = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  inkReassembly.on("pageerror", (error) => errors.push(error.message));
  inkReassembly.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await load(inkReassembly);
  await inkReassembly.getByRole("button", { name: "想", exact: true }).click();
  let inkState = await state(inkReassembly);
  const inkCanvas = inkReassembly.locator("canvas");
  const inkBox = await inkCanvas.boundingBox();
  const tearOrigin = screenPoint(inkBox, inkState.componentGrabPoints["相"][4]);
  await inkReassembly.mouse.move(tearOrigin.x, tearOrigin.y);
  await inkReassembly.mouse.down();
  for (let i = 1; i <= 35 && inkState.characters.length === 1; i++) {
    await inkReassembly.mouse.move(tearOrigin.x + i * 9, tearOrigin.y - i);
    await advance(inkReassembly, 1000 / 60);
    inkState = await state(inkReassembly);
  }
  assert.deepEqual(
    inkState.characters.map((object) => object.char),
    ["相", "心"],
  );
  assertTilesInsideBoard(inkState.characters, inkBox, "ink-contact tear");
  assert.match(inkState.message, /hold one piece's ink over the other tile/);
  await inkReassembly.mouse.up();
  inkState = await state(inkReassembly);
  const reassemblyXiangTile = inkState.characters.find(
    (object) => object.char === "相",
  ).tile;
  const heartTileBefore = inkState.characters.find(
    (object) => object.char === "心",
  ).tile;
  const beforeInkOverlap = getFaceOverlap(
    inkState.characters.find((object) => object.char === "相"),
    inkState.characters.find((object) => object.char === "心"),
  );
  assert.ok(
    beforeInkOverlap.x <= 0 || beforeInkOverlap.y <= 0,
    "the sibling tile faces remain separate before the ink drag",
  );
  inkState = await dragInkToPoint(
    inkReassembly,
    inkBox,
    inkState,
    "心",
    {
      x: reassemblyXiangTile.center.x,
      y: reassemblyXiangTile.center.y + 50,
    },
    "tile",
  );
  assert.equal(
    inkState.magnet.active,
    true,
    "dragged terminal ink carries 心's tile into 相 to engage recombination",
  );
  assert.equal(inkState.magnet.contact, "tiles");
  assert.notEqual(inkState.magnet.tileOverlap, null);
  await inkReassembly.screenshot({
    path: "output/playground/ink-contact-magnet.png",
    fullPage: true,
  });
  assert.ok(
    Math.abs(
      inkState.characters.find((object) => object.char === "心").tile.center.x -
        heartTileBefore.center.x,
    ) > 1,
    "dragging terminal ink moves its tile as one object",
  );
  inkState = await guideHeldHeartIntoPlace(inkReassembly, inkBox, inkState);
  assert.deepEqual(
    inkState.characters.map((object) => object.char),
    ["想"],
    "dragging terminal 心 ink moves the tile and recombines it into 想",
  );
  await inkReassembly.mouse.up();
  await inkReassembly.close();

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
  assertSiblingFacesSeparate(
    current.characters.find((object) => object.char === "木"),
    current.characters.find((object) => object.char === "目"),
    "horizontal 相 tear siblings",
  );
  assertTilesInsideBoard(current.characters, box, "horizontal 相 tear");
  assert.equal(
    current.magnet.active,
    false,
    "the wrong-side horizontal arrangement does not attract",
  );
  await page.mouse.up();

  // Reset to 想, split as soon as child faces clear each other, then reassemble by gripping 相's tile.
  await page.getByRole("button", { name: "想", exact: true }).click();
  current = await state();
  const originalCenter = current.pose;
  box = await canvas.boundingBox();
  const xiangPoint = current.componentGrabPoints["相"][4];
  const xiangOrigin = screenPoint(box, xiangPoint);
  await page.mouse.move(xiangOrigin.x, xiangOrigin.y);
  await page.mouse.down();
  for (let i = 1; i <= 40 && current.phase !== "loose"; i++) {
    await page.mouse.move(xiangOrigin.x + i * 9, xiangOrigin.y);
    await advance(page, 1000 / 60);
    current = await state();
  }
  assert.equal(current.phase, "loose");
  assertSiblingFacesSeparate(
    current.characters.find((object) => object.char === "相"),
    current.characters.find((object) => object.char === "心"),
    "想 tear siblings",
  );
  assertTilesInsideBoard(current.characters, box, "想 tear");
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

  // Weighted mode keeps the unpulled component anchored during a tear.
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
    ) < 0.1,
    "the unpulled component stays anchored even in Weighted mode",
  );
  await page.mouse.up();
  await page.locator('input[name="physics-mode"][value="fixed"]').check();

  for (const character of ["休", "好"]) {
    await page.getByRole("button", { name: character, exact: true }).click();
    current = await state();
    assert.equal(current.character, character);
    assert.equal(current.boardPreset, "single");
    assert.equal(Object.keys(current.componentGrabPoints).length, 2);
  }
  await page.getByRole("button", { name: "Five starters" }).click();
  current = await state();
  assert.equal(current.boardPreset, "starters");
  assert.equal(current.characters.length, 5);
  assertNoTileOverlap(current.characters, "restored five starter board");
  await page.getByRole("button", { name: "Reset" }).click();
  current = await state();
  assert.equal(current.boardPreset, "starters");
  assert.equal(current.characters.length, 5);

  // Released ink returns to its own tile when it is outside a composition field.
  const restoration = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  restoration.on("pageerror", (error) => errors.push(error.message));
  restoration.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await load(restoration);
  await restoration.getByRole("button", { name: "想", exact: true }).click();
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
  const heartInkHome = { ...looseHeart.center };
  const heartGrab = looseHeart.grabPoints.reduce((farthest, point) =>
    Math.hypot(point.x - looseHeart.center.x, point.y - looseHeart.center.y) >
    Math.hypot(
      farthest.x - looseHeart.center.x,
      farthest.y - looseHeart.center.y,
    )
      ? point
      : farthest,
  );
  const pullAwayFromXiang = {
    x: away.x * 8,
    y: away.y * 8,
  };
  await drag(
    restoration,
    restorationBox,
    heartGrab,
    12,
    pullAwayFromXiang.x,
    pullAwayFromXiang.y,
  );
  restoredState = await state(restoration);
  const pulledHeart = restoredState.characters.find(
    (object) => object.char === "心",
  );
  assert.equal(
    restoredState.activeContacts[0]?.interaction,
    "tile",
    "dragging an unsupported 心 stroke moves the entire tile",
  );
  assert.ok(
    Math.hypot(
      pulledHeart.tile.center.x - heartTileHome.x,
      pulledHeart.tile.center.y - heartTileHome.y,
    ) > 1,
    "the whole 心 tile follows its stroke drag",
  );
  assert.ok(
    Math.hypot(
      pulledHeart.center.x -
        heartInkHome.x -
        (pulledHeart.tile.center.x - heartTileHome.x),
      pulledHeart.center.y -
        heartInkHome.y -
        (pulledHeart.tile.center.y - heartTileHome.y),
    ) < 8,
    "the terminal character's ink stays attached to its moving tile",
  );
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
      settledHeart.center.x -
        settledHeart.tile.center.x -
        (heartInkHome.x - heartTileHome.x),
      settledHeart.center.y -
        settledHeart.tile.center.y -
        (heartInkHome.y - heartTileHome.y),
    ) < 8,
    "the terminal character remains attached after release",
  );
  assert.ok(
    Math.abs(settledHeart.center.angle - settledHeart.tile.center.angle) < 0.01,
    "the terminal character keeps its tile orientation",
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
  let mobileState = await state(mobile);
  assert.equal(mobileState.characters.length, 5);
  assertNoTileOverlap(mobileState.characters, "mobile five starter board");
  await mobile.getByLabel("Any dictionary character").fill("信");
  await mobile.getByRole("button", { name: "Add to board" }).click();
  await mobile.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).characters.length === 6,
  );
  mobileState = await state(mobile);
  assert.ok(mobileState.characters.some((object) => object.char === "信"));
  assertNoTileOverlap(mobileState.characters, "mobile custom board");
  await mobile.screenshot({
    path: "output/playground/custom-board-mobile.png",
    fullPage: true,
  });
  await mobile.getByRole("button", { name: "Five starters" }).click();
  assert.equal((await state(mobile)).characters.length, 5);
  // In the two-column phone layout, 想 and its neighboring 相 tile are close
  // enough that a newly detached 相 face will overlap the existing tile.
  let crowded = await state(mobile);
  await mobile.locator("canvas").scrollIntoViewIfNeeded();
  const crowdedBox = await mobile.locator("canvas").boundingBox();
  const crowdedSource = crowded.characters.find(
    (object) => object.char === "想",
  );
  const crowdedNeighbor = crowded.characters.find(
    (object) => object.char === "相",
  );
  const crowdedOrigin = screenPoint(
    crowdedBox,
    crowded.componentGrabPoints["相"][5],
  );
  await mobile.mouse.move(crowdedOrigin.x, crowdedOrigin.y);
  await mobile.mouse.down();
  for (let i = 1; i <= 50; i++) {
    await mobile.mouse.move(crowdedOrigin.x + i * 8, crowdedOrigin.y);
    await advance(mobile, 1000 / 60);
    crowded = await state(mobile);
    if (crowded.phase === "loose") break;
  }
  assert.equal(crowded.phase, "loose");
  const crowdedFreeXiang = crowded.characters.find(
    (object) => object.char === "相" && object.free,
  );
  const crowdedHeart = crowded.characters.find(
    (object) => object.char === "心" && object.free,
  );
  assertSiblingFacesSeparate(
    crowdedFreeXiang,
    crowdedHeart,
    "crowded starter tear siblings",
  );
  assert.ok(
    getFaceOverlap(crowdedFreeXiang, crowdedNeighbor).x > 0 &&
      getFaceOverlap(crowdedFreeXiang, crowdedNeighbor).y > 0,
    "a child tile is created at source clearance even while it overlaps an unrelated existing tile",
  );
  assert.ok(
    crowded.characters.some((object) => object.id === crowdedNeighbor.id),
    "the unrelated neighboring tile remains present after the tear",
  );
  assert.ok(
    !crowded.characters.some((object) => object.id === crowdedSource.id),
    "the source character is replaced by its two component tiles",
  );
  await mobile.mouse.up();
  await mobile.getByRole("button", { name: "Five starters" }).click();
  assert.equal((await state(mobile)).characters.length, 5);
  await mobile.getByRole("button", { name: "想", exact: true }).click();
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
  assert.equal(touched.tearing?.tetherCount, 0);
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
  const initialXiangY = (await state(mobile)).componentPoints["相"].y;
  for (let i = 1; i <= 60 && touched.phase !== "loose"; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { ...first, y: first.y - i * 8 },
        second,
        { ...third, y: third.y - i * 8 },
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
  assertSiblingFacesSeparate(
    touched.characters.find((object) => object.char === "相"),
    touched.characters.find((object) => object.char === "心"),
    "multitouch tear siblings",
  );
  assertTilesInsideBoard(touched.characters, mobileBox, "multitouch tear");
  assert.deepEqual(
    touched.characters.map((object) => object.char),
    ["相", "心"],
  );
  assert.ok(
    touched.characters.find((object) => object.char === "相").inkCenter.y <
      initialXiangY,
    "the two contacts pulling 相 move its ink up",
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

  // Fetch an unseen composition recipe when two independently torn pieces meet.
  const crossComposeLab = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  crossComposeLab.on("pageerror", (error) => errors.push(error.message));
  crossComposeLab.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await load(crossComposeLab);
  const crossBox = await crossComposeLab.locator("canvas").boundingBox();
  let crossState = await state(crossComposeLab);
  crossState = await tearComponent(
    crossComposeLab,
    crossBox,
    crossState,
    "好",
    "子",
  );
  await crossComposeLab.mouse.up();
  crossState = await state(crossComposeLab);
  crossState = await tearComponent(
    crossComposeLab,
    crossBox,
    crossState,
    "休",
    "人",
  );
  await crossComposeLab.mouse.up();
  crossState = await state(crossComposeLab);
  const looseSeed = crossState.characters.find(
    (object) => object.char === "子",
  );
  const looseWood = crossState.characters.find(
    (object) => object.char === "木",
  );
  assert.ok(looseSeed && looseWood);
  await crossComposeLab.waitForFunction(() =>
    JSON.parse(window.render_game_to_text()).loadedRecipeCharacters.includes(
      "李",
    ),
  );
  crossState = await state(crossComposeLab);
  assert.ok(
    crossState.loadedRecipeCharacters.includes("李"),
    "preload 子 + 木's possible 李 recipe before their tiles meet",
  );
  crossState = await dragTileFace(
    crossComposeLab,
    crossBox,
    crossState,
    "子",
    { x: looseWood.tile.center.x + 88, y: looseWood.tile.center.y },
    looseSeed.id,
  );
  crossState = await state(crossComposeLab);
  assert.equal(crossState.magnet.parent, "李");
  crossState = await guideHeldTileToMagnet(
    crossComposeLab,
    crossBox,
    crossState,
    looseSeed.id,
    "李",
  );
  assert.ok(
    crossState.characters.some((object) => object.char === "李"),
    "子 + 木 load and compose as 李 when their tiles meet",
  );
  await crossComposeLab.mouse.up();
  await crossComposeLab.close();

  // Build 森 from 木 pieces through the reviewed pairwise 林 recipe.
  const woodLab = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  woodLab.on("pageerror", (error) => errors.push(error.message));
  woodLab.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await load(woodLab);
  // Keep this geometry-heavy nested-tear scenario anchored; the startup test
  // above separately verifies weighted movement from the default state.
  await woodLab.locator('input[name="physics-mode"][value="fixed"]').check();
  await woodLab.getByRole("button", { name: "森", exact: true }).click();
  await woodLab.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).character === "森",
  );
  const woodBox = await woodLab.locator("canvas").boundingBox();
  let woodState = await state(woodLab);
  woodState = await tearComponent(woodLab, woodBox, woodState, "森", "木");
  assert.deepEqual(
    woodState.characters.map((object) => object.char),
    ["木", "林"],
    "森 tears into 木 and the nested 林 group",
  );
  await woodLab.mouse.up();
  await woodLab.waitForFunction(() =>
    JSON.parse(window.render_game_to_text()).characters.some(
      (object) => object.char === "林" && object.decomposable,
    ),
  );
  woodState = await state(woodLab);
  const originalWoodId = woodState.characters.find(
    (object) => object.char === "木",
  ).id;
  woodState = await tearComponent(woodLab, woodBox, woodState, "林", "木");
  assert.deepEqual(
    woodState.characters.map((object) => object.char).sort(),
    ["木", "木", "木"],
    "林 tears into its two mapped 木 components",
  );
  const nestedWoodIds = new Set(
    woodState.characters
      .filter((object) => object.char === "木" && object.id !== originalWoodId)
      .map((object) => object.id),
  );
  assert.equal(nestedWoodIds.size, 2);
  const nestedWoods = woodState.characters.filter((object) =>
    nestedWoodIds.has(object.id),
  );
  assertSiblingFacesSeparate(
    nestedWoods[0],
    nestedWoods[1],
    "林 tear sibling faces",
  );
  await woodLab.mouse.up();
  woodState = await state(woodLab);
  const lowerWoods = woodState.characters
    .filter((object) => nestedWoodIds.has(object.id))
    .sort((a, b) => a.tile.center.x - b.tile.center.x);
  assert.equal(lowerWoods.length, 2);
  const leftWood = lowerWoods[0];
  const rightWood = lowerWoods[1];
  woodState = await dragTileFace(
    woodLab,
    woodBox,
    woodState,
    "木",
    {
      x: leftWood.tile.center.x + 88,
      y: leftWood.tile.center.y,
    },
    rightWood.id,
  );
  if (!woodState.characters.some((object) => object.char === "林")) {
    assert.equal(woodState.magnet.active, true);
    assert.equal(woodState.magnet.parent, "林");
    woodState = await guideHeldTileToMagnet(
      woodLab,
      woodBox,
      woodState,
      rightWood.id,
      "林",
    );
  }
  assert.ok(
    woodState.characters.some((object) => object.char === "林"),
    "the two lower 木 tiles recombine as 林",
  );
  await woodLab.mouse.up();
  woodState = await state(woodLab);
  const topWood = woodState.characters.find((object) => object.char === "木");
  const lowerLin = woodState.characters.find((object) => object.char === "林");
  assert.ok(topWood && lowerLin);
  woodState = await dragTileFace(
    woodLab,
    woodBox,
    woodState,
    "林",
    {
      x: topWood.tile.center.x,
      y: topWood.tile.center.y + 88,
    },
    lowerLin.id,
  );
  if (!woodState.characters.some((object) => object.char === "森")) {
    assert.equal(woodState.magnet.active, true);
    assert.equal(woodState.magnet.parent, "森");
    woodState = await guideHeldTileToMagnet(
      woodLab,
      woodBox,
      woodState,
      lowerLin.id,
      "森",
    );
  }
  assert.ok(
    woodState.characters.some((object) => object.char === "森"),
    "林 + 木 recombine as 森",
  );
  const assembledForest = woodState.characters.find(
    (object) => object.char === "森",
  );
  assert.equal(woodState.characters.length, 1, "森 is one assembled tile");
  assert.ok(
    Math.abs(assembledForest.scale.x - 0.36) < 0.02 &&
      Math.abs(assembledForest.scale.y - 0.36) < 0.02,
    `reassembled 森 returns to its standard tile scale, got ${JSON.stringify(assembledForest.scale)}`,
  );
  await woodLab.screenshot({
    path: "output/playground/forest-size-normalized.png",
    fullPage: true,
  });
  await woodLab.mouse.up();
  await woodLab.close();

  const toolsPage = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  await load(toolsPage);
  let toolsState = await state(toolsPage);
  await toolsPage.getByLabel("Arrange mode").selectOption("all-at-once");
  await toolsPage.getByRole("button", { name: "Arrange tiles" }).click();
  assert.equal((await state(toolsPage)).animatingTiles, true);
  await advance(toolsPage, 1200);
  toolsState = await state(toolsPage);
  assert.equal(toolsState.animatingTiles, false);
  assertNoTileOverlap(toolsState.characters, "arranged grid");
  assert.ok(
    Math.abs(toolsState.characters[0].tile.center.x - 90) < 1 &&
      Math.abs(toolsState.characters[0].tile.center.y - 90) < 1,
    "arrange fills the grid from the top-left",
  );
  await toolsPage.screenshot({
    path: "output/playground/arranged-grid.png",
    fullPage: true,
  });

  await toolsPage.getByRole("button", { name: "Reset" }).click();
  const beforeSequential = await state(toolsPage);
  await toolsPage.getByLabel("Arrange mode").selectOption("one-by-one");
  await toolsPage.getByRole("button", { name: "Arrange tiles" }).click();
  await advance(toolsPage, 180);
  const duringSequential = await state(toolsPage);
  assert.equal(duringSequential.animatingTiles, true);
  assert.ok(
    Math.hypot(
      duringSequential.characters[0].tile.center.x -
        beforeSequential.characters[0].tile.center.x,
      duringSequential.characters[0].tile.center.y -
        beforeSequential.characters[0].tile.center.y,
    ) > 1,
    "the first tile starts moving immediately",
  );
  assert.deepEqual(
    duringSequential.characters[1].tile.center,
    beforeSequential.characters[1].tile.center,
    "later tiles wait for the one-at-a-time animation",
  );
  await advance(toolsPage, 1800);
  assert.equal((await state(toolsPage)).animatingTiles, false);

  await toolsPage.getByRole("button", { name: "Reset" }).click();
  await toolsPage.getByLabel("Arrange mode").selectOption("by-component");
  await toolsPage.getByRole("button", { name: "Arrange tiles" }).click();
  await advance(toolsPage, 1800);
  toolsState = await state(toolsPage);
  const componentOrder = [...toolsState.characters]
    .sort(
      (a, b) =>
        Math.round(a.tile.center.y) - Math.round(b.tile.center.y) ||
        Math.round(a.tile.center.x) - Math.round(b.tile.center.x),
    )
    .map((object) => object.char);
  assert.equal(
    Math.abs(componentOrder.indexOf("相") - componentOrder.indexOf("休")),
    1,
    "tiles that share 木 as a component are placed next to each other",
  );

  await toolsPage.getByRole("button", { name: "Reset" }).click();
  await toolsPage
    .getByRole("checkbox", { name: "Snap to grid when released" })
    .check();
  toolsState = await state(toolsPage);
  const toolsBox = await toolsPage.locator("canvas").boundingBox();
  assert.ok(toolsBox);
  await dragTileFace(toolsPage, toolsBox, toolsState, "想", {
    x:
      toolsState.characters.find((object) => object.char === "想").tile.center
        .x + 65,
    y:
      toolsState.characters.find((object) => object.char === "想").tile.center
        .y + 45,
  });
  await toolsPage.mouse.up();
  assert.equal((await state(toolsPage)).animatingTiles, true);
  await advance(toolsPage, 700);
  toolsState = await state(toolsPage);
  assert.equal(toolsState.snapToGrid, true);
  assert.equal(toolsState.animatingTiles, false);
  assertNoTileOverlap(toolsState.characters, "snap-to-grid release");
  await toolsPage.screenshot({
    path: "output/playground/snap-to-grid.png",
    fullPage: true,
  });
  await toolsPage.close();

  const hintPage = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  await load(hintPage);
  const hintBox = await hintPage.locator("canvas").boundingBox();
  assert.ok(hintBox);
  const hintInitial = await state(hintPage);
  await doubleTapTile(hintPage, hintBox, hintInitial, "想");
  await hintPage.waitForFunction(() => {
    const game = JSON.parse(window.render_game_to_text());
    return (
      game.characters.some((object) => object.char === "相") &&
      game.characters.some((object) => object.char === "心")
    );
  });
  await hintPage
    .getByRole("button", { name: "Highlight compatible tiles" })
    .click();
  const hinted = await state(hintPage);
  const compatibleHeartTile = hinted.characters.find(
    (object) => object.char === "心",
  );
  assert.ok(compatibleHeartTile);
  assert.ok(
    hinted.highlightedTileIds.includes(compatibleHeartTile.id),
    "hints highlight the compatible 心 tile for focused 相",
  );
  assert.equal(
    await hintPage
      .getByRole("status")
      .filter({ hasText: "compatible tiles highlighted" })
      .count(),
    1,
  );
  await hintPage.screenshot({
    path: "output/playground/compatible-tile-hint.png",
    fullPage: true,
  });
  await hintPage.close();

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
    "Playground passed: bounded one-step asset preloading and early composition candidates, normalized glyph size, pronunciation/definition focus and optional tear pop feedback, double-tap unfolding, tile repulsion, arbitrary dictionary selection, dynamic cross-source composition, flat/raised/draped/silk rendering and hit testing, fixed/weighted response, tile-aligned ink restoration, safe early release, recursive tears and scale-preserving reassembly, four simultaneous contacts, tile- and ink-contact-gated magnetic pull/distortion/snap, one-at-a-time and all-at-once tile arrangement, shared-component grouping, optional grid snapping, compatible-tile hints, reversed-layout rejection, reduced motion, resize, loading recovery, and game navigation.",
  );
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceDiscoveryClock,
  createDiscoveryRun,
  discoveryScore,
  drawCharacter,
  finishDiscoveryRun,
  recordDiscoveryArrival,
  recordDiscoveryBoard,
  startDiscoveryRun,
} from "../src/lib/discoveryRun";

test("Discovery Run adds one point per arrival and each unique discovery", () => {
  let run = createDiscoveryRun("playground", 9, ["想", "相", "心"]);
  assert.equal(run.phase, "setup");
  run = startDiscoveryRun(run);
  assert.equal(run.delivered, 1);
  assert.equal(discoveryScore(run), 1);

  run = recordDiscoveryBoard(run, ["想", "木", "木", "目"]);
  assert.deepEqual(run.discoveries, ["木", "目"]);
  assert.equal(discoveryScore(run), 3);

  run = recordDiscoveryBoard(run, ["想"]);
  run = recordDiscoveryArrival(run);
  assert.deepEqual(run.discoveries, ["木", "目"]);
  assert.equal(discoveryScore(run), 4);
});

test("Discovery Run clocks arrivals in ten-second intervals and accumulates survival", () => {
  const run = startDiscoveryRun(
    createDiscoveryRun("hsk1-traditional", 16, ["人"]),
  );
  let result = advanceDiscoveryClock(run, 9_999);
  assert.equal(result.arrivalsDue, 0);
  assert.equal(result.run.elapsedMs, 9_999);
  assert.equal(result.run.survivedMs, 9_999);

  result = advanceDiscoveryClock(result.run, 20_001);
  assert.equal(result.arrivalsDue, 3);
  assert.equal(result.run.elapsedMs, 0);
  assert.equal(result.run.survivedMs, 30_000);
});

test("Discovery Run stops at capacity and selects only from its collection", () => {
  const run = startDiscoveryRun(
    createDiscoveryRun("hsk1-simplified", 25, ["你", "好"]),
  );
  assert.equal(
    drawCharacter(["你", "好"], () => 0),
    "你",
  );
  assert.equal(
    drawCharacter(["你", "好"], () => 0.999),
    "好",
  );
  assert.equal(
    drawCharacter([], () => 0),
    null,
  );
  assert.equal(finishDiscoveryRun(run, 24).phase, "running");
  assert.equal(finishDiscoveryRun(run, 25).phase, "over");
});

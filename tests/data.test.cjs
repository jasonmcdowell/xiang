const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const d = require("../public/data/decomp.json");
const c = require("../public/data/compose_pairs.json");
const m = require("../public/data/meta.json");
const f = require("../public/data/component_freq.json");

test("all indices conserve complete recipes, normalized characters, and multiplicity", () => {
  assert.deepEqual(d["想"], ["相", "心"]);
  const counts = {};
  for (const [parent, children] of Object.entries(d)) {
    assert.ok(children.length >= 2);
    for (const child of children) {
      assert.match(child, /^\p{Unified_Ideograph}$/u);
      assert.ok(m[child]);
      assert.ok(!"忄扌氵亻訁礻".includes(child));
      counts[child] = (counts[child] || 0) + 1;
    }
    if (children.length === 2) {
      assert.ok(c[children.join("|")].includes(parent));
      assert.ok(c[[...children].reverse().join("|")].includes(parent));
    }
  }
  assert.deepEqual(counts, f);
  for (const [key, parents] of Object.entries(c)) {
    assert.deepEqual(parents, [...new Set(parents)].sort());
    for (const parent of parents)
      assert.deepEqual([...d[parent]].sort(), key.split("|").sort());
  }
});

test("generator rejects partial nested expressions, missing children, unknowns and non-Hanzi", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xiang-data-"));
  try {
    const entries = [
      ...["木", "口", "心", "相"].map((character) => ({
        character,
        decomposition: "？",
      })),
      { character: "想", decomposition: "⿱相心" },
      { character: "品", decomposition: "⿲口口⿱木木" },
      { character: "林", decomposition: "⿰木木" },
      { character: "杏", decomposition: "⿱木？" },
      { character: "困", decomposition: "⿴囗木" },
      { character: "呆", decomposition: "⿱口A" },
      { character: "悃", decomposition: "⿰忄木" },
      { character: "森", decomposition: "⿲木木木" },
      { character: "本", decomposition: "⿱木口口" },
    ];
    const input = path.join(dir, "input.jsonl");
    fs.writeFileSync(input, entries.map((e) => JSON.stringify(e)).join("\n"));
    const extensions = path.join(dir, "extensions.json");
    fs.writeFileSync(extensions, "{}");
    execFileSync(process.execPath, [
      "scripts/build_indices.js",
      "--extensions",
      extensions,
      "--input",
      input,
      "--outdir",
      dir,
    ]);
    const result = JSON.parse(fs.readFileSync(path.join(dir, "decomp.json")));
    assert.deepEqual(
      Object.keys(result).sort(),
      ["想", "林", "悃", "森"].sort(),
    );
    assert.deepEqual(result["悃"], ["心", "木"]);
    assert.deepEqual(result["森"], ["木", "木", "木"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reviewed nested extensions validate full structure and fail on stale or incomplete recipes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xiang-reviewed-"));
  try {
    const input = path.join(dir, "input.jsonl"),
      extensions = path.join(dir, "extensions.json");
    fs.writeFileSync(
      input,
      [
        { character: "木", decomposition: "？" },
        { character: "森", decomposition: "⿱木⿰木木" },
      ]
        .map(JSON.stringify)
        .join("\n"),
    );
    const run = () =>
      execFileSync(
        process.execPath,
        [
          "scripts/build_indices.js",
          "--input",
          input,
          "--outdir",
          dir,
          "--extensions",
          extensions,
        ],
        { stdio: "pipe" },
      );
    const rule = {
      ids: "⿱木⿰木木",
      children: ["木", "木", "木"],
      reason: "Three complete tree components.",
    };
    fs.writeFileSync(extensions, JSON.stringify({ 森: rule }));
    run();
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(dir, "decomp.json")))["森"],
      rule.children,
    );
    for (const invalid of [
      { ...rule, children: ["木", "木"] },
      { ...rule, ids: "⿲木木木" },
      { ...rule, children: ["木", "木", "口"] },
    ]) {
      fs.writeFileSync(extensions, JSON.stringify({ 森: invalid }));
      assert.throws(run, /Invalid reviewed decomposition/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const WEIGHTS = {
  freq: 1.0,
  connectivity: 2.0,
  productivity: 1.0,
};

function printHelp() {
  console.log(`Usage: node scripts/build_dense_pool.js --charlist path --name name [--outdir dir] [--k n]

Builds a dense recomposition pool from a character list.

Defaults:
  --outdir public/data/pools
  --k      40
`);
}

function parseArgs(argv) {
  const args = {
    charlist: null,
    name: null,
    outdir: "public/data/pools",
    k: 40,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "--charlist") {
      args.charlist = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--name") {
      args.name = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--outdir") {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--k") {
      args.k = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    console.warn(`Unknown argument: ${arg}`);
    args.help = true;
  }

  return args;
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function sortedList(iterable) {
  return [...iterable].sort((a, b) => a.localeCompare(b));
}

function loadCharlist(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const result = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const chars = Array.from(trimmed);
    if (chars.length !== 1) {
      console.warn(`Skipping invalid line (expected 1 char): ${trimmed}`);
      continue;
    }
    result.add(chars[0]);
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.charlist || !args.name) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const charlistPath = path.resolve(process.cwd(), args.charlist);
  const outdir = path.resolve(process.cwd(), args.outdir);
  const k = Number.isFinite(args.k) ? args.k : 40;

  if (!fs.existsSync(charlistPath)) {
    console.error(`Charlist not found: ${charlistPath}`);
    process.exit(1);
  }

  const decompPath = path.resolve(process.cwd(), "public/data/decomp.json");
  const composePath = path.resolve(process.cwd(), "public/data/compose_pairs.json");

  if (!fs.existsSync(decompPath) || !fs.existsSync(composePath)) {
    console.error("Missing indices. Run npm run build:data first.");
    process.exit(1);
  }

  const decomp = loadJson(decompPath);
  const compose = loadJson(composePath);

  const charlistSet = loadCharlist(charlistPath);

  const composeParentSet = new Set();
  for (const parents of Object.values(compose)) {
    for (const parent of parents) {
      composeParentSet.add(parent);
    }
  }

  const universeSet = new Set([...Object.keys(decomp), ...composeParentSet]);
  const targetChars = sortedList(
    [...charlistSet].filter((ch) => universeSet.has(ch)),
  );
  const targetSet = new Set(targetChars);

  const componentFreq = new Map();
  for (const ch of targetChars) {
    const children = decomp[ch];
    if (!Array.isArray(children)) {
      continue;
    }
    for (const child of children) {
      componentFreq.set(child, (componentFreq.get(child) || 0) + 1);
    }
  }

  const componentSet = new Set(componentFreq.keys());
  const connectivityMap = new Map();
  const productivityMap = new Map();

  function ensureSet(map, key) {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    return map.get(key);
  }

  for (const [pair, parents] of Object.entries(compose)) {
    const [a, b] = pair.split("|");
    if (!a || !b) {
      continue;
    }
    const parentsInTarget = parents.filter((p) => targetSet.has(p));
    if (parentsInTarget.length === 0) {
      continue;
    }
    if (componentSet.has(a) && componentSet.has(b)) {
      ensureSet(connectivityMap, a).add(b);
      ensureSet(connectivityMap, b).add(a);
    }
    if (componentSet.has(a)) {
      const setA = ensureSet(productivityMap, a);
      for (const p of parentsInTarget) {
        setA.add(p);
      }
    }
    if (componentSet.has(b)) {
      const setB = ensureSet(productivityMap, b);
      for (const p of parentsInTarget) {
        setB.add(p);
      }
    }
  }

  const components = [];
  for (const component of componentSet) {
    const freq = componentFreq.get(component) || 0;
    const connectivity = connectivityMap.has(component)
      ? connectivityMap.get(component).size
      : 0;
    const productivity = productivityMap.has(component)
      ? productivityMap.get(component).size
      : 0;
    const score =
      freq * WEIGHTS.freq +
      connectivity * WEIGHTS.connectivity +
      productivity * WEIGHTS.productivity;
    components.push({
      component,
      freq,
      connectivity,
      productivity,
      score,
    });
  }

  components.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.freq !== a.freq) return b.freq - a.freq;
    if (b.connectivity !== a.connectivity)
      return b.connectivity - a.connectivity;
    if (b.productivity !== a.productivity)
      return b.productivity - a.productivity;
    return a.component.localeCompare(b.component);
  });

  const chosen = components.slice(0, Math.max(0, k));
  const chosenComponents = chosen.map((item) => item.component);

  const connectivityValues = components.map((item) => item.connectivity);
  const connectivityMax =
    connectivityValues.length > 0
      ? Math.max(...connectivityValues)
      : 0;
  const connectivityAvg =
    connectivityValues.length > 0
      ? connectivityValues.reduce((sum, v) => sum + v, 0) /
        connectivityValues.length
      : 0;

  const output = {
    name: args.name,
    characters: targetChars,
    components: chosenComponents,
    stats: {
      target_input_count: charlistSet.size,
      target_filtered_count: targetChars.length,
      component_candidate_count: componentSet.size,
      chosen_k: chosenComponents.length,
      weights: WEIGHTS,
      connectivity: {
        max: connectivityMax,
        average: Number(connectivityAvg.toFixed(2)),
      },
      top_components: chosen.slice(0, 10).map((item) => ({
        char: item.component,
        score: Number(item.score.toFixed(2)),
        freq: item.freq,
        connectivity: item.connectivity,
        productivity: item.productivity,
      })),
    },
  };

  fs.mkdirSync(outdir, { recursive: true });
  const outputPath = path.join(outdir, `${args.name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log("Dense pool summary");
  console.log(`Name: ${args.name}`);
  console.log(`Target characters: ${targetChars.length}`);
  console.log(`Component candidates: ${componentSet.size}`);
  console.log(`Chosen K: ${chosenComponents.length}`);
  console.log("Top 10 components");
  for (const item of chosen.slice(0, 10)) {
    console.log(
      `${item.component} score=${item.score.toFixed(2)} freq=${item.freq} conn=${item.connectivity} prod=${item.productivity}`,
    );
  }
}

main();

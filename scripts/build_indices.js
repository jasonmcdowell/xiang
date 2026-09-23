#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const IDS_TWO = new Set([
  "⿰",
  "⿱",
  "⿴",
  "⿵",
  "⿶",
  "⿷",
  "⿸",
  "⿹",
  "⿺",
  "⿻",
]);
const IDS_THREE = new Set(["⿲", "⿳"]);

const VARIANT_MAP = new Map([
  ["忄", "心"],
  ["扌", "手"],
  ["氵", "水"],
  ["亻", "人"],
  ["訁", "言"],
  ["礻", "示"],
]);

function printHelp() {
  console.log(`Usage: node scripts/build_indices.js [--input path] [--outdir dir]

Generates static indices from Make Me a Hanzi dictionary JSONL:
  - public/data/decomp.json
  - public/data/compose_pairs.json
  - public/data/component_freq.json
  - public/data/meta.json

Defaults:
  --input  data/makemeahanzi/dictionary.txt
  --outdir public/data
  --extensions data/decomposition_extensions.json
`);
}

function parseArgs(argv) {
  const args = {
    input: "data/makemeahanzi/dictionary.txt",
    outdir: "public/data",
    help: false,
    extensions: "data/decomposition_extensions.json",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "--input") {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--extensions") {
      args.extensions = argv[++i];
      continue;
    }
    if (arg === "--outdir") {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    console.warn(`Unknown argument: ${arg}`);
    args.help = true;
  }

  return args;
}

function isSingleChar(value) {
  return typeof value === "string" && /^\p{Unified_Ideograph}$/u.test(value);
}

function normalizeChar(value) {
  return VARIANT_MAP.get(value) || value;
}

function parseExpr(chars, index) {
  const ch = chars[index];
  if (!ch) {
    return null;
  }

  if (IDS_TWO.has(ch) || IDS_THREE.has(ch)) {
    const arity = IDS_THREE.has(ch) ? 3 : 2;
    let i = index + 1;
    const children = [];
    for (let c = 0; c < arity; c += 1) {
      const parsed = parseExpr(chars, i);
      if (!parsed) {
        return null;
      }
      children.push(parsed.expr);
      i = parsed.nextIndex;
    }
    return {
      expr: chars.slice(index, i).join(""),
      nextIndex: i,
      children,
    };
  }

  return {
    expr: ch,
    nextIndex: index + 1,
  };
}

function parseImmediateChildren(ids) {
  if (!ids || ids.startsWith("？")) {
    return null;
  }
  const chars = Array.from(ids);
  const parsed = parseExpr(chars, 0);
  if (!parsed || !parsed.children) {
    return null;
  }
  if (parsed.nextIndex !== chars.length) {
    return null;
  }
  return parsed.children;
}

function addComposeEntry(map, key, parentChar) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  map.get(key).add(parentChar);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const outputDir = path.resolve(process.cwd(), args.outdir);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const extensions = JSON.parse(fs.readFileSync(args.extensions, "utf8"));
  const decompMap = new Map();
  const composeMap = new Map();
  const freqMap = new Map();
  const metaMap = new Map();

  let processedCount = 0;
  let decomposableCount = 0;

  // First streamed pass establishes supported standalone dictionary characters.
  const knownCharacters = new Set();
  const catalog = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity,
  });
  for await (const line of catalog) {
    try {
      const entry = JSON.parse(line);
      if (isSingleChar(entry.character)) knownCharacters.add(entry.character);
    } catch {
      /* The second pass reports malformed records. */
    }
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    processedCount += 1;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (err) {
      console.warn(`Skipping invalid JSON on line ${processedCount}: ${err}`);
      continue;
    }

    const character = entry.character;
    const decomposition = entry.decomposition;
    if (!isSingleChar(character)) {
      continue;
    }
    const pinyin = Array.isArray(entry.pinyin) ? entry.pinyin : [];
    const definition =
      typeof entry.definition === "string" ? entry.definition : "";
    metaMap.set(character, { pinyin, definition });

    if (typeof decomposition !== "string") {
      continue;
    }

    let immediateChildren = parseImmediateChildren(decomposition);
    const extension = extensions[character];
    if (extension) {
      const leaves = Array.from(decomposition)
        .filter((c) => !IDS_TWO.has(c) && !IDS_THREE.has(c))
        .map(normalizeChar);
      if (
        !immediateChildren ||
        extension.ids !== decomposition ||
        !Array.isArray(extension.children) ||
        extension.children.length !== 3 ||
        !extension.reason ||
        JSON.stringify(leaves) !== JSON.stringify(extension.children) ||
        !extension.children.every(
          (c) =>
            isSingleChar(c) && knownCharacters.has(c) && normalizeChar(c) === c,
        )
      ) {
        throw new Error(
          `Invalid reviewed decomposition for ${character}; check the exact IDS and all children.`,
        );
      }
      immediateChildren = extension.children;
    }
    if (!immediateChildren) {
      continue;
    }
    if (immediateChildren.some((child) => child.includes("？"))) {
      continue;
    }

    const normalizedChildren = [];
    let invalid = false;
    for (const child of immediateChildren) {
      if (Array.from(child).length !== 1) {
        invalid = true;
        break;
      }
      const normalized = normalizeChar(child);
      if (!isSingleChar(normalized) || !knownCharacters.has(normalized)) {
        invalid = true;
        break;
      }
      normalizedChildren.push(normalized);
    }

    if (invalid || normalizedChildren.length < 2) {
      continue;
    }

    decompMap.set(character, normalizedChildren);
    decomposableCount += 1;

    for (const child of normalizedChildren) {
      freqMap.set(child, (freqMap.get(child) || 0) + 1);
    }

    if (normalizedChildren.length === 2) {
      const [a, b] = normalizedChildren;
      addComposeEntry(composeMap, `${a}|${b}`, character);
      addComposeEntry(composeMap, `${b}|${a}`, character);
    }
  }

  const decompObj = Object.fromEntries(
    [...decompMap.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const composeObj = Object.fromEntries(
    [...composeMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => [
        key,
        [...value].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      ]),
  );
  const freqObj = Object.fromEntries(
    [...freqMap.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const metaObj = Object.fromEntries(
    [...metaMap.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );

  fs.writeFileSync(
    path.join(outputDir, "decomp.json"),
    JSON.stringify(decompObj, null, 2),
  );
  fs.writeFileSync(
    path.join(outputDir, "compose_pairs.json"),
    JSON.stringify(composeObj, null, 2),
  );
  fs.writeFileSync(
    path.join(outputDir, "component_freq.json"),
    JSON.stringify(freqObj, null, 2),
  );
  fs.writeFileSync(
    path.join(outputDir, "meta.json"),
    JSON.stringify(metaObj, null, 2),
  );

  const topComponents = [...freqMap.entries()]
    .sort((a, b) => {
      const countDiff = b[1] - a[1];
      if (countDiff !== 0) {
        return countDiff;
      }
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })
    .slice(0, 20);

  console.log("Build indices summary");
  console.log(`Processed entries: ${processedCount}`);
  console.log(`Decomposable entries: ${decomposableCount}`);
  console.log(`decomp.json size: ${decompMap.size}`);
  console.log(`compose_pairs.json size: ${composeMap.size}`);
  console.log(`component_freq.json size: ${freqMap.size}`);
  console.log(`meta.json size: ${metaMap.size}`);

  if (decompMap.has("想")) {
    const children = decompMap.get("想");
    const hasExample =
      children.length === 2 &&
      children.includes("相") &&
      children.includes("心");
    console.log(`Check 想 -> 相 + 心: ${hasExample ? "OK" : "MISMATCH"}`);
    const composeKey = "相|心";
    const composeSet = composeMap.get(composeKey);
    const composeOk = composeSet ? composeSet.has("想") : false;
    console.log(
      `Check compose_pairs["相|心"] includes 想: ${composeOk ? "OK" : "MISSING"}`,
    );
  } else {
    console.log("Check 想 -> 相 + 心: SKIPPED (想 not in dataset)");
  }

  console.log("Top 20 components by frequency");
  for (const [char, count] of topComponents) {
    console.log(`${char} ${count}`);
  }
}

main().catch((err) => {
  console.error("Failed to build indices:", err);
  process.exit(1);
});

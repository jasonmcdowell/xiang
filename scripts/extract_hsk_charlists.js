#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function printHelp() {
  console.log(`Usage: node scripts/extract_hsk_charlists.js [--outdir dir]

Builds HSK character lists from:
  - data/complete-hsk-vocabulary/1.json
  - data/complete-hsk-vocabulary/2.json

Outputs (one char per line, sorted):
  - public/data/charlists/hsk1_simp.txt
  - public/data/charlists/hsk1_trad.txt
  - public/data/charlists/hsk12_simp.txt
  - public/data/charlists/hsk12_trad.txt

Defaults:
  --outdir public/data/charlists
`);
}

function parseArgs(argv) {
  const args = {
    outdir: "public/data/charlists",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
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

function isHanCodepoint(codepoint) {
  return (
    (codepoint >= 0x3400 && codepoint <= 0x4dbf) || // Extension A
    (codepoint >= 0x4e00 && codepoint <= 0x9fff) || // Unified Ideographs
    (codepoint >= 0xf900 && codepoint <= 0xfaff) || // Compatibility Ideographs
    (codepoint >= 0x20000 && codepoint <= 0x2a6df) || // Extension B
    (codepoint >= 0x2a700 && codepoint <= 0x2b73f) || // Extension C
    (codepoint >= 0x2b740 && codepoint <= 0x2b81f) || // Extension D
    (codepoint >= 0x2b820 && codepoint <= 0x2ceaf) || // Extension E
    (codepoint >= 0x2ceb0 && codepoint <= 0x2ebef) || // Extension F
    (codepoint >= 0x30000 && codepoint <= 0x3134f) // Extension G
  );
}

function extractHanChars(text, targetSet) {
  if (typeof text !== "string") {
    return;
  }
  for (const ch of Array.from(text)) {
    const codepoint = ch.codePointAt(0);
    if (codepoint && isHanCodepoint(codepoint)) {
      targetSet.add(ch);
    }
  }
}

function loadJsonArray(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`Expected array in ${filePath}`);
  }
  return data;
}

function sortedList(set) {
  return [...set].sort((a, b) => a.localeCompare(b));
}

function writeList(outPath, list) {
  const content = list.join("\n");
  fs.writeFileSync(outPath, content + (content ? "\n" : ""));
}

function printStats(label, list) {
  const sample = list.slice(0, 10).join("");
  console.log(`${label}: ${list.length} (${sample || "n/a"})`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const input1 = path.resolve(process.cwd(), "data/complete-hsk-vocabulary/1.json");
  const input2 = path.resolve(process.cwd(), "data/complete-hsk-vocabulary/2.json");
  const outputDir = path.resolve(process.cwd(), args.outdir);
  fs.mkdirSync(outputDir, { recursive: true });

  const hsk1 = loadJsonArray(input1);
  const hsk2 = loadJsonArray(input2);

  const hsk1Simp = new Set();
  const hsk1Trad = new Set();
  const hsk2Simp = new Set();
  const hsk2Trad = new Set();

  for (const entry of hsk1) {
    extractHanChars(entry.simplified, hsk1Simp);
    if (Array.isArray(entry.forms)) {
      for (const form of entry.forms) {
        extractHanChars(form.traditional, hsk1Trad);
      }
    }
  }

  for (const entry of hsk2) {
    extractHanChars(entry.simplified, hsk2Simp);
    if (Array.isArray(entry.forms)) {
      for (const form of entry.forms) {
        extractHanChars(form.traditional, hsk2Trad);
      }
    }
  }

  const hsk12Simp = new Set([...hsk1Simp, ...hsk2Simp]);
  const hsk12Trad = new Set([...hsk1Trad, ...hsk2Trad]);

  const hsk1SimpList = sortedList(hsk1Simp);
  const hsk1TradList = sortedList(hsk1Trad);
  const hsk12SimpList = sortedList(hsk12Simp);
  const hsk12TradList = sortedList(hsk12Trad);

  writeList(path.join(outputDir, "hsk1_simp.txt"), hsk1SimpList);
  writeList(path.join(outputDir, "hsk1_trad.txt"), hsk1TradList);
  writeList(path.join(outputDir, "hsk12_simp.txt"), hsk12SimpList);
  writeList(path.join(outputDir, "hsk12_trad.txt"), hsk12TradList);

  console.log("HSK charlist summary");
  printStats("hsk1_simp", hsk1SimpList);
  printStats("hsk1_trad", hsk1TradList);
  printStats("hsk12_simp", hsk12SimpList);
  printStats("hsk12_trad", hsk12TradList);
}

main();

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  idioms: "data/ChID-Dataset/idiomList.txt",
  decomp: "public/data/decomp.json",
  compose: "public/data/compose_pairs.json",
  out: "public/data/puzzles/chid_scrambles_v1.json",
  maxResults: 10,
  maxShared: 1,
  targetLen: 4,
  minLen: 4,
  maxLen: 6,
  expandDepth2K: 0,
  bagSizeCap: 14,
  expansionCandidateCap: 8,
};

function printHelp() {
  console.log(`Usage: node scripts/build_chid_scrambles.js [options]

Options:
  --idioms       Path to idiomList.txt (default: ${DEFAULTS.idioms})
  --decomp       Path to decomp.json (default: ${DEFAULTS.decomp})
  --compose      Path to compose_pairs.json (default: ${DEFAULTS.compose})
  --out          Output JSON path (default: ${DEFAULTS.out})
  --max-results  Max scrambles per target (default: ${DEFAULTS.maxResults})
  --max-shared   Max shared chars with target (default: ${DEFAULTS.maxShared})
  --min-len      Minimum scramble length (default: ${DEFAULTS.minLen})
  --max-len      Maximum scramble length (default: ${DEFAULTS.maxLen})
  --expand-depth2-k  Expand up to K tiles by one extra decomp step (default: ${DEFAULTS.expandDepth2K})
  --require-parent-decomp  Only allow parents with binary decomp (default: false)
  --limit        Optional cap on eligible targets (debug)
  -h, --help     Show help
`);
}

function parseArgs(argv) {
  const args = {
    idioms: DEFAULTS.idioms,
    decomp: DEFAULTS.decomp,
    compose: DEFAULTS.compose,
    out: DEFAULTS.out,
    maxResults: DEFAULTS.maxResults,
    maxShared: DEFAULTS.maxShared,
    minLen: DEFAULTS.minLen,
    maxLen: DEFAULTS.maxLen,
    expandDepth2K: DEFAULTS.expandDepth2K,
    requireParentDecomp: false,
    limit: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "--idioms") {
      args.idioms = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--decomp") {
      args.decomp = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--compose") {
      args.compose = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out") {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--max-results") {
      args.maxResults = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--max-shared") {
      args.maxShared = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--min-len") {
      args.minLen = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--max-len") {
      args.maxLen = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--expand-depth2-k") {
      args.expandDepth2K = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--require-parent-decomp") {
      args.requireParentDecomp = true;
      continue;
    }
    if (arg === "--limit") {
      args.limit = Number.parseInt(argv[i + 1], 10);
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
    (codepoint >= 0x3400 && codepoint <= 0x4dbf) ||
    (codepoint >= 0x4e00 && codepoint <= 0x9fff) ||
    (codepoint >= 0xf900 && codepoint <= 0xfaff) ||
    (codepoint >= 0x20000 && codepoint <= 0x2a6df) ||
    (codepoint >= 0x2a700 && codepoint <= 0x2b73f) ||
    (codepoint >= 0x2b740 && codepoint <= 0x2b81f) ||
    (codepoint >= 0x2b820 && codepoint <= 0x2ceaf) ||
    (codepoint >= 0x2ceb0 && codepoint <= 0x2ebef) ||
    (codepoint >= 0x30000 && codepoint <= 0x3134f)
  );
}

function isHanChar(ch) {
  if (!ch) return false;
  const codepoint = ch.codePointAt(0);
  return Boolean(codepoint && isHanCodepoint(codepoint));
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadIdioms(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  return data;
}

function buildPairMapFromDecomp(decomp) {
  const map = new Map();
  const validParents = new Set();
  for (const [parent, children] of Object.entries(decomp)) {
    if (!Array.isArray(children) || children.length !== 2) {
      continue;
    }
    const [a, b] = children;
    if (!isHanChar(a) || !isHanChar(b)) {
      continue;
    }
    validParents.add(parent);
    const key = a <= b ? `${a}|${b}` : `${b}|${a}`;
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key).add(parent);
  }
  return { map, validParents };
}

function mergeComposePairs({ pairMap, composePairs, validParents, requireParentDecomp }) {
  for (const [key, parents] of Object.entries(composePairs)) {
    if (!Array.isArray(parents)) {
      continue;
    }
    if (!pairMap.has(key)) {
      pairMap.set(key, new Set());
    }
    const set = pairMap.get(key);
    for (const parent of parents) {
      if (requireParentDecomp && !validParents.has(parent)) {
        continue;
      }
      set.add(parent);
    }
  }
}

function finalizePairMap(pairMap) {
  const finalized = new Map();
  for (const [key, set] of pairMap.entries()) {
    const list = [...set].sort((a, b) => a.localeCompare(b));
    finalized.set(key, list);
  }
  return finalized;
}

function buildDegreeMap(pairToParents) {
  const degree = new Map();
  for (const key of pairToParents.keys()) {
    const [a, b] = key.split("|");
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  }
  return degree;
}

function buildTargetCharCounts(target) {
  const counts = new Map();
  for (const ch of Array.from(target)) {
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  return counts;
}

function sharedCharCount(targetCounts, phrase) {
  const counts = new Map(targetCounts);
  let shared = 0;
  for (const ch of Array.from(phrase)) {
    const count = counts.get(ch) || 0;
    if (count > 0) {
      shared += 1;
      counts.set(ch, count - 1);
    }
  }
  return shared;
}

function bagToKey(bag) {
  const items = [];
  for (const [ch, count] of bag.entries()) {
    for (let i = 0; i < count; i += 1) {
      items.push(ch);
    }
  }
  return items.sort((a, b) => a.localeCompare(b)).join("");
}

function cloneBag(bag) {
  return new Map(bag);
}

function removeFromBag(bag, ch, amount) {
  const next = cloneBag(bag);
  const current = next.get(ch) || 0;
  if (current <= amount) {
    next.delete(ch);
  } else {
    next.set(ch, current - amount);
  }
  return next;
}

function expandBagOnce(bag, char, decomp) {
  const children = decomp[char];
  if (!Array.isArray(children) || children.length !== 2) {
    return null;
  }
  const [a, b] = children;
  if (!isHanChar(a) || !isHanChar(b)) {
    return null;
  }
  let next = removeFromBag(bag, char, 1);
  next.set(a, (next.get(a) || 0) + 1);
  next.set(b, (next.get(b) || 0) + 1);
  return { bag: next, children };
}

function buildExpansionOptions(bag, decomp, degreeMap, maxK) {
  if (maxK <= 0) {
    return [];
  }
  const candidates = [];
  for (const [ch, count] of bag.entries()) {
    const children = decomp[ch];
    if (!Array.isArray(children) || children.length !== 2) {
      continue;
    }
    const [a, b] = children;
    if (!isHanChar(a) || !isHanChar(b)) {
      continue;
    }
    const degree = degreeMap.get(ch) || 0;
    candidates.push({ ch, count, degree });
  }
  candidates.sort((a, b) => b.degree - a.degree || a.ch.localeCompare(b.ch));
  const capped = candidates.slice(0, DEFAULTS.expansionCandidateCap);

  const expansions = [];
  function recurse(index, remaining, current) {
    if (remaining === 0 || index >= capped.length) {
      if (current.length > 0) {
        expansions.push([...current]);
      }
      return;
    }
    const item = capped[index];
    const maxUse = Math.min(item.count, remaining);
    for (let use = 0; use <= maxUse; use += 1) {
      for (let i = 0; i < use; i += 1) {
        current.push(item.ch);
      }
      recurse(index + 1, remaining - use, current);
      current.length -= use;
    }
  }
  recurse(0, maxK, []);

  expansions.sort(
    (a, b) => a.length - b.length || a.join("").localeCompare(b.join("")),
  );
  return expansions.filter((list) => list.length > 0);
}

function pickNextChar(bag, pairToParents) {
  let bestChar = null;
  let bestOptions = Infinity;
  const chars = [...bag.keys()].sort((a, b) => a.localeCompare(b));
  for (const ch of chars) {
    const count = bag.get(ch) || 0;
    if (count <= 0) {
      continue;
    }
    let options = 0;
    for (const other of chars) {
      const otherCount = bag.get(other) || 0;
      if (otherCount <= 0) {
        continue;
      }
      if (ch === other && otherCount < 2) {
        continue;
      }
      const key = ch <= other ? `${ch}|${other}` : `${other}|${ch}`;
      const parents = pairToParents.get(key);
      if (parents && parents.length > 0) {
        options += parents.length;
      }
    }
    if (options === 0) {
      continue;
    }
    if (options < bestOptions) {
      bestOptions = options;
      bestChar = ch;
      if (bestOptions === 1) {
        break;
      }
    }
  }
  return bestChar;
}

function dfsScramble({
  bag,
  pairToParents,
  targetCounts,
  targetPhrase,
  maxShared,
  minLen,
  maxLen,
  results,
  phraseChars,
  memo,
}) {
  if (bag.size === 0) {
    if (phraseChars.length >= minLen && phraseChars.length <= maxLen) {
      const phrase = phraseChars.join("");
      if (phrase === targetPhrase) {
        return;
      }
      const shared = sharedCharCount(targetCounts, phrase);
      if (shared > maxShared) {
        return;
      }
      results.set(phrase, shared);
    }
    return;
  }
  if (phraseChars.length >= maxLen) {
    return;
  }

  const bagKey = `${phraseChars.length}:${bagToKey(bag)}`;
  if (memo.has(bagKey)) {
    return;
  }

  const first = pickNextChar(bag, pairToParents);
  if (!first) {
    memo.add(bagKey);
    return;
  }

  const chars = [...bag.keys()].sort((a, b) => a.localeCompare(b));
  for (const second of chars) {
    const countSecond = bag.get(second) || 0;
    if (countSecond <= 0) {
      continue;
    }
    if (first === second && (bag.get(first) || 0) < 2) {
      continue;
    }
    const key = first <= second ? `${first}|${second}` : `${second}|${first}`;
    const parents = pairToParents.get(key);
    if (!parents || parents.length === 0) {
      continue;
    }
    for (const parent of parents) {
      const nextBag = removeFromBag(
        removeFromBag(bag, first, 1),
        second,
        1,
      );
      phraseChars.push(parent);
      dfsScramble({
        bag: nextBag,
        pairToParents,
        targetCounts,
        targetPhrase,
        maxShared,
        minLen,
        maxLen,
        results,
        phraseChars,
        memo,
      });
      phraseChars.pop();
    }
  }

  memo.add(bagKey);
}

function generateScrambles({
  idioms,
  decomp,
  pairToParents,
  degreeMap,
  validParents,
  maxResults,
  maxShared,
  minLen,
  maxLen,
  expandDepth2K,
  bagSizeCap,
  limit,
  includeItems,
}) {
  let eligibleTargets = 0;
  let targetsWithScrambles = 0;
  let totalScrambles = 0;
  const lengthCounts = { 4: 0, 5: 0, 6: 0 };
  let scramblesFromBase = 0;
  let scramblesFromExpanded = 0;
  let targetsWithScramblesBase = 0;
  let targetsWithScramblesExpanded = 0;
  const items = [];

  for (const idiom of idioms) {
    if (typeof idiom !== "string") {
      continue;
    }
    const chars = Array.from(idiom);
    if (chars.length !== DEFAULTS.targetLen) {
      continue;
    }
    if (!chars.every((ch) => isHanChar(ch))) {
      continue;
    }

    const bag = new Map();
    let valid = true;
    for (const ch of chars) {
      const children = decomp[ch];
      if (!Array.isArray(children) || children.length !== 2) {
        valid = false;
        break;
      }
      const [a, b] = children;
      if (!isHanChar(a) || !isHanChar(b)) {
        valid = false;
        break;
      }
      bag.set(a, (bag.get(a) || 0) + 1);
      bag.set(b, (bag.get(b) || 0) + 1);
    }

    if (!valid) {
      continue;
    }

    eligibleTargets += 1;
    if (limit && eligibleTargets > limit) {
      break;
    }

    const resultsBase = new Map();
    const targetCounts = buildTargetCharCounts(idiom);
    dfsScramble({
      bag,
      pairToParents,
      targetCounts,
      targetPhrase: idiom,
      maxShared,
      minLen,
      maxLen,
      results: resultsBase,
      phraseChars: [],
      memo: new Set(),
    });

    const candidateSets = [];

    if (resultsBase.size > 0) {
      candidateSets.push({
        results: resultsBase,
        expansion: [],
        bag,
      });
    }

    if (resultsBase.size === 0 && expandDepth2K > 0) {
      const expansionOptions = buildExpansionOptions(
        bag,
        decomp,
        degreeMap,
        expandDepth2K,
      );
      for (const expansion of expansionOptions) {
        let expandedBag = cloneBag(bag);
        let ok = true;
        for (const ch of expansion) {
          const result = expandBagOnce(expandedBag, ch, decomp);
          if (!result) {
            ok = false;
            break;
          }
          expandedBag = result.bag;
        }
        if (!ok) {
          continue;
        }
        let size = 0;
        for (const count of expandedBag.values()) {
          size += count;
        }
        if (size > bagSizeCap) {
          continue;
        }
        const resultsExpanded = new Map();
        dfsScramble({
          bag: expandedBag,
          pairToParents,
          targetCounts,
          targetPhrase: idiom,
          maxShared,
          minLen,
          maxLen,
          results: resultsExpanded,
          phraseChars: [],
          memo: new Set(),
        });
        if (resultsExpanded.size > 0) {
          candidateSets.push({
            results: resultsExpanded,
            expansion,
            bag: expandedBag,
          });
        }
      }
    }

    if (candidateSets.length === 0) {
      continue;
    }

    const rankedCandidates = candidateSets
      .map((candidate) => {
        const sorted = [...candidate.results.entries()]
          .map(([phrase, shared]) => ({
            phrase,
            shared,
            len: Array.from(phrase).length,
            score: 10000 * (Array.from(phrase).length - 4) + shared * 1000,
          }))
          .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return a.phrase.localeCompare(b.phrase);
          })
          .slice(0, maxResults);
        return {
          ...candidate,
          sorted,
        };
      })
      .filter((candidate) => candidate.sorted.length > 0)
      .sort((a, b) => {
        if (b.sorted.length !== a.sorted.length) {
          return b.sorted.length - a.sorted.length;
        }
        const bestA = a.sorted[0];
        const bestB = b.sorted[0];
        if (bestA.score !== bestB.score) {
          return bestA.score - bestB.score;
        }
        return a.expansion.join("").localeCompare(b.expansion.join(""));
      });

    if (rankedCandidates.length === 0) {
      continue;
    }

    const selected = rankedCandidates[0];
    const sorted = selected.sorted;

    targetsWithScrambles += 1;
    totalScrambles += sorted.length;
    if (selected.expansion.length === 0) {
      targetsWithScramblesBase += 1;
      scramblesFromBase += sorted.length;
    } else {
      targetsWithScramblesExpanded += 1;
      scramblesFromExpanded += sorted.length;
    }
    for (const item of sorted) {
      if (item.len === 4) lengthCounts[4] += 1;
      if (item.len === 5) lengthCounts[5] += 1;
      if (item.len === 6) lengthCounts[6] += 1;
    }

    if (includeItems) {
      const bagList = [];
      let bagSize = 0;
      for (const [ch, count] of selected.bag.entries()) {
        for (let i = 0; i < count; i += 1) {
          bagList.push(ch);
          bagSize += 1;
        }
      }

      const scrambleMeta = sorted.map((item) => {
        let decomposableChars = 0;
        for (const ch of Array.from(item.phrase)) {
          if (validParents.has(ch)) {
            decomposableChars += 1;
          }
        }
        const nonDecomposableChars = item.len - decomposableChars;
        return {
          phrase: item.phrase,
          shared: item.shared,
          len: item.len,
          decomposableChars,
          nonDecomposableChars,
          bagSize,
          expansionsUsed: selected.expansion.length,
        };
      });

      const lengths = scrambleMeta.map((item) => item.len);
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);
      const avgLen =
        lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
      const allDecompCount = scrambleMeta.filter(
        (item) => item.nonDecomposableChars === 0,
      ).length;
      const pctAllDecomposable = Number(
        ((allDecompCount / scrambleMeta.length) * 100).toFixed(2),
      );

      items.push({
        target: idiom,
        bag: bagList.sort((a, b) => a.localeCompare(b)),
        expansion: {
          depth2Expanded: [...selected.expansion].sort((a, b) =>
            a.localeCompare(b),
          ),
        },
        scrambles: scrambleMeta,
        summary: {
          minLen,
          avgLen: Number(avgLen.toFixed(2)),
          maxLen,
          pctAllDecomposable,
        },
      });
    }
  }

  return {
    eligibleTargets,
    targetsWithScrambles,
    totalScrambles,
    lengthCounts,
    scramblesFromBase,
    scramblesFromExpanded,
    targetsWithScramblesBase,
    targetsWithScramblesExpanded,
    items,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const expandDepth2K = Number.isFinite(args.expandDepth2K)
    ? Math.max(0, Math.min(4, args.expandDepth2K))
    : 0;
  const minLen = Number.isFinite(args.minLen) ? args.minLen : DEFAULTS.minLen;
  const maxLen = Number.isFinite(args.maxLen) ? args.maxLen : DEFAULTS.maxLen;
  const boundedMinLen = Math.max(1, Math.min(minLen, maxLen));
  const boundedMaxLen = Math.max(boundedMinLen, maxLen);

  const idiomsPath = path.resolve(process.cwd(), args.idioms);
  const decompPath = path.resolve(process.cwd(), args.decomp);
  const composePath = path.resolve(process.cwd(), args.compose);
  const outPath = path.resolve(process.cwd(), args.out);

  if (!fs.existsSync(idiomsPath)) {
    console.error(`Idiom list not found: ${idiomsPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(decompPath)) {
    console.error(`Decomp not found: ${decompPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(composePath)) {
    console.error(`Compose pairs not found: ${composePath}`);
    process.exit(1);
  }

  const idioms = loadIdioms(idiomsPath);
  const decomp = loadJson(decompPath);
  const composePairs = loadJson(composePath);

  const { map: decompPairMap, validParents } = buildPairMapFromDecomp(decomp);
  const decompOnlyPairMap = finalizePairMap(decompPairMap);

  const mergedPairMap = new Map(decompPairMap);
  mergeComposePairs({
    pairMap: mergedPairMap,
    composePairs,
    validParents,
    requireParentDecomp: args.requireParentDecomp,
  });
  const mergedFinal = finalizePairMap(mergedPairMap);
  const degreeMap = buildDegreeMap(mergedFinal);

  const beforeStats = generateScrambles({
    idioms,
    decomp,
    pairToParents: decompOnlyPairMap,
    degreeMap,
    validParents,
    maxResults: args.maxResults,
    maxShared: args.maxShared,
    minLen: boundedMinLen,
    maxLen: boundedMaxLen,
    expandDepth2K: 0,
    bagSizeCap: DEFAULTS.bagSizeCap,
    limit: args.limit,
    includeItems: false,
  });

  const afterStats = generateScrambles({
    idioms,
    decomp,
    pairToParents: mergedFinal,
    degreeMap,
    validParents,
    maxResults: args.maxResults,
    maxShared: args.maxShared,
    minLen: boundedMinLen,
    maxLen: boundedMaxLen,
    expandDepth2K,
    bagSizeCap: DEFAULTS.bagSizeCap,
    limit: args.limit,
    includeItems: true,
  });

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    config: {
      maxResultsPerTarget: args.maxResults,
      maxShared: args.maxShared,
      targetLen: DEFAULTS.targetLen,
      minLen: boundedMinLen,
      maxLen: boundedMaxLen,
      binaryOnly: true,
      requireParentDecomp: args.requireParentDecomp,
      expandDepth2K,
    },
    stats: {
      totalIdioms: idioms.length,
      eligibleTargets: afterStats.eligibleTargets,
      targetsWithAtLeastOneScramble: afterStats.targetsWithScrambles,
      totalScrambles: afterStats.totalScrambles,
    },
    items: afterStats.items,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const sortedByScrambles = [...afterStats.items]
    .sort((a, b) => b.scrambles.length - a.scrambles.length)
    .slice(0, 5);

  console.log("ChID scramble summary");
  console.log(
    `Before (decomp only) targetsWithScrambles: ${beforeStats.targetsWithScrambles}, totalScrambles: ${beforeStats.totalScrambles}`,
  );
  console.log(
    `After (merged) targetsWithScrambles: ${afterStats.targetsWithScrambles}, totalScrambles: ${afterStats.totalScrambles}`,
  );
  console.log(
    `Length breakdown (4/5/6): ${afterStats.lengthCounts[4]}/${afterStats.lengthCounts[5]}/${afterStats.lengthCounts[6]}`,
  );
  console.log(
    `Targets with scrambles (k=0): ${afterStats.targetsWithScramblesBase}`,
  );
  console.log(
    `Targets with scrambles (k>0): ${afterStats.targetsWithScramblesExpanded}`,
  );
  console.log(
    `Scrambles by source (k=0/k>0): ${afterStats.scramblesFromBase}/${afterStats.scramblesFromExpanded}`,
  );
  console.log("Top 5 targets by scramble count");
  for (const item of sortedByScrambles) {
    console.log(`${item.target} ${item.scrambles.length}`);
  }
}

main();

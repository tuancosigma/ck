#!/usr/bin/env node
/**
 * check-skill-routing.js
 *
 * CI gate: verifies that every shipped /ck:<name> skill is reachable from
 * at least one routing file (claude/rules/skill-domain-routing.md or
 * claude/rules/skill-workflow-routing.md). Prevents discoverability drift.
 *
 * Skills intentionally absent from routing (meta-routers, orchestrator-internal,
 * maintainer-tier) are listed in scripts/skill-routing-allowlist.json with
 * required justification.
 *
 * Usage: node scripts/check-skill-routing.js
 * Exit 0 = every skill is routed or allowlisted
 * Exit 1 = uncovered skill(s) found
 *
 * Companion to check-skill-cross-refs.js: that one verifies refs point to
 * registered skills; this one verifies registered skills are referenced.
 */

'use strict';

const { readFileSync, readdirSync, lstatSync } = require('fs');
const path = require('path');
const { validateReason } = require('./lib/validate-allowlist-reason.js');

const repoRoot = path.resolve(__dirname, '..');
const claudeDir = path.join(repoRoot, 'claude');
const rulesDir = path.join(claudeDir, 'rules');
const allowlistPath = path.join(__dirname, 'skill-routing-allowlist.json');

// Routing files that count as "reachable from"
const ROUTING_FILES = [
  path.join(rulesDir, 'skill-domain-routing.md'),
  path.join(rulesDir, 'skill-workflow-routing.md'),
];

const CK_REF_RE = /\/ck:([a-z][a-z0-9-]*)/g;

function findFiles(dir, predicate) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      results.push(...findFiles(full, predicate));
    } else if (predicate(entry, full)) {
      results.push(full);
    }
  }
  return results;
}

function extractSkillName(content) {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const nameMatch = fmMatch[1].match(/^name:\s*['"]?([^\s'"]+)['"]?\s*$/m);
  if (!nameMatch) return null;
  return nameMatch[1].trim();
}

// Build set of registered skill names (normalized: ck:foo -> foo).
// Only includes ck:-namespaced skills; other namespaces (ckm:*, taste:*, kai:*)
// are out of scope per epic #711.
function buildSkillRegistry() {
  const skillsDir = path.join(claudeDir, 'skills');
  const skillFiles = findFiles(skillsDir, (entry) => entry === 'SKILL.md');
  const registry = new Set();

  for (const filePath of skillFiles) {
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error(`[!] Could not read ${filePath}: ${err.message}`);
      continue;
    }
    const rawName = extractSkillName(content);
    if (!rawName) continue;
    // Skip non-ck: namespaces
    if (!rawName.startsWith('ck:')) continue;
    registry.add(rawName.slice(3));
  }
  return registry;
}

// Collect all /ck:<name> references appearing in routing files.
function collectRoutedSkills() {
  const routed = new Set();
  for (const file of ROUTING_FILES) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch (err) {
      console.error(`[!] Could not read routing file ${file}: ${err.message}`);
      continue;
    }
    let match;
    CK_REF_RE.lastIndex = 0;
    while ((match = CK_REF_RE.exec(content)) !== null) {
      routed.add(match[1]);
    }
  }
  return routed;
}

function loadAllowlist() {
  let raw;
  try {
    raw = readFileSync(allowlistPath, 'utf8');
  } catch (err) {
    console.error(`[!] Could not read allowlist ${allowlistPath}: ${err.message}`);
    return { allowed: new Set(), reasons: new Map() };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[X] Invalid JSON in allowlist: ${err.message}`);
    process.exit(1);
  }
  const allowed = new Set();
  const reasons = new Map();
  if (Array.isArray(parsed.allowed)) {
    for (const entry of parsed.allowed) {
      if (entry && typeof entry.name === 'string') {
        const result = validateReason(entry.reason);
        if (!result.ok) {
          console.error(`[X] Allowlist entry "${entry.name}" ${result.error}`);
          process.exit(1);
        }
        allowed.add(entry.name);
        reasons.set(entry.name, entry.reason);
      }
    }
  }
  return { allowed, reasons };
}

function main() {
  const registry = buildSkillRegistry();
  const routed = collectRoutedSkills();
  const { allowed, reasons } = loadAllowlist();

  // Find uncovered: registered AND not routed AND not allowlisted
  const uncovered = [...registry].filter((s) => !routed.has(s) && !allowed.has(s)).sort();

  // Find stale allowlist entries: allowlisted but no longer in registry
  const staleAllowlist = [...allowed].filter((s) => !registry.has(s)).sort();

  // Find redundant allowlist entries: allowlisted AND routed (allowlist no longer needed)
  const redundantAllowlist = [...allowed].filter((s) => routed.has(s)).sort();

  let hasErrors = false;

  if (uncovered.length > 0) {
    hasErrors = true;
    console.error(`[X] ${uncovered.length} skill(s) are not reachable from any routing file:`);
    for (const name of uncovered) {
      console.error(`  - /ck:${name}`);
    }
    console.error('');
    console.error('Fix options:');
    console.error('  1. Add the skill to claude/rules/skill-domain-routing.md (preferred for user-facing skills)');
    console.error('  2. Add to claude/rules/skill-workflow-routing.md (if it fits a workflow chain)');
    console.error('  3. Add to scripts/skill-routing-allowlist.json with justification (for meta/orchestrator-internal skills)');
    console.error('');
  }

  if (staleAllowlist.length > 0) {
    hasErrors = true;
    console.error(`[X] ${staleAllowlist.length} stale allowlist entry/entries (skill no longer exists):`);
    for (const name of staleAllowlist) {
      console.error(`  - "${name}" — reason was: ${reasons.get(name)}`);
    }
    console.error('  Fix: remove these from scripts/skill-routing-allowlist.json');
    console.error('');
  }

  if (redundantAllowlist.length > 0) {
    hasErrors = true;
    console.error(`[X] ${redundantAllowlist.length} redundant allowlist entry/entries (skill is now routed):`);
    for (const name of redundantAllowlist) {
      console.error(`  - "${name}"`);
    }
    console.error('  Fix: remove these from scripts/skill-routing-allowlist.json — they are no longer needed.');
    console.error('');
  }

  if (!hasErrors) {
    console.log(
      `[OK] skill-routing: ${registry.size} ck:* skill(s), ${routed.size} routed, ${allowed.size} allowlisted — all covered.`
    );
    process.exit(0);
  }
  process.exit(1);
}

main();

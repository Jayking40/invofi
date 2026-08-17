#!/usr/bin/env node
/**
 * localStorage secret guard (issue #187).
 *
 * Static regression guard that fails the build if wallet key, seed, or
 * signature material is ever written to localStorage. localStorage is
 * readable by any XSS and persists across sessions, so secrets must live in
 * sessionStorage or in-memory state only (the one persistent wallet value —
 * the last-connected wallet's *public address* — is not a secret and is
 * explicitly allowed).
 *
 * It scans the shipped client source (`src/`) for:
 *   - `localStorage.setItem(<key>, <value>)` / `window.localStorage.setItem(...)`
 *     where the key, or the value expression (identifier or string literal),
 *     contains a forbidden word (secret, privateKey, seed, signature, …).
 *   - `localStorage.<name> = …` / `localStorage['<name>'] = …` where the
 *     property name contains a forbidden word.
 *
 * The word list mirrors the runtime guard in `src/hooks/useLocalStorage.ts`
 * (FORBIDDEN_STORAGE_KEY_WORDS). Keep both in sync.
 *
 * Wired into the frontend `lint` script so the existing CI lint step enforces
 * it without any workflow changes.
 *
 * Run: node scripts/localstorage-secrets-guard.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_WORDS = [
  'secret',
  'privatekey',
  'seed',
  'mnemonic',
  'passphrase',
  'password',
  'pw', // shorthand for password — the original #187 regression used `devicePw`
  'signature',
  'signing',
  'credential',
  'recovery',
];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export function hasForbiddenWord(text) {
  const normalized = text.toLowerCase();
  return FORBIDDEN_WORDS.some(word => normalized.includes(word));
}

/**
 * Finds the argument list of a `localStorage.setItem(` call starting at
 * `openParenIndex` in `source`, handling nested parentheses and string
 * literals so the scan survives multi-line calls.
 * Returns the raw argument substring, or null if unbalanced.
 */
function extractCallArgs(source, openParenIndex) {
  let depth = 0;
  let quote = null;
  let i = openParenIndex;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i++; // skip escaped char
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;
  return source.slice(openParenIndex + 1, i);
}

/** Splits a raw argument list on top-level commas. */
function splitTopLevelArgs(raw) {
  const args = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      current += ch;
      if (ch === '\\') { current += raw[++i] ?? ''; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; current += ch; }
    else if (ch === '(' || ch === '[' || ch === '{') { depth++; current += ch; }
    else if (ch === ')' || ch === ']' || ch === '}') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * Scans a single source file for localStorage writes of secret material.
 * Returns an array of `{ file, line, column, message }` violations.
 */
export function findViolations(source, filePath) {
  const violations = [];
  const push = (index, message) => {
    const before = source.slice(0, index);
    const line = before.split('\n').length;
    const column = index - before.lastIndexOf('\n');
    violations.push({ file: filePath, line, column, message });
  };

  // 1) setItem( calls — flag forbidden key or a value expression (identifier
  //    or string literal) that names secret material.
  const setItemRe = /\b(?:window\.)?localStorage\.setItem\s*\(/g;
  let m;
  while ((m = setItemRe.exec(source)) !== null) {
    const argsRaw = extractCallArgs(source, m[0].length - 1 + m.index);
    if (argsRaw === null) continue;
    const args = splitTopLevelArgs(argsRaw);
    if (args.length < 2) continue;
    const [keyArg, valueArg] = args;
    if (hasForbiddenWord(keyArg)) {
      push(m.index, `localStorage.setItem key "${keyArg.slice(0, 60)}" may contain secret material`);
    }
    // Value side: only flag identifiers/string literals, so data payloads
    // like JSON.stringify({...}) are not false-positived.
    if (/^['"`]/.test(valueArg.trim()) || /^[A-Za-z_$][\w$]*$/.test(valueArg.trim())) {
      if (hasForbiddenWord(valueArg)) {
        push(m.index, `localStorage.setItem value "${valueArg.slice(0, 60)}" may contain secret material`);
      }
    }
  }

  // 2) localStorage.<name> = … assignments.
  const dotAssignRe = /\b(?:window\.)?localStorage\.([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = dotAssignRe.exec(source)) !== null) {
    if (hasForbiddenWord(m[1])) {
      push(m.index, `localStorage.${m[1]} assignment may store secret material`);
    }
  }

  // 3) localStorage['<name>'] = … / localStorage["<name>"] = … assignments.
  const bracketAssignRe = /\b(?:window\.)?localStorage\s*\[\s*(['"`])(.*?)\1\s*\]\s*=/g;
  while ((m = bracketAssignRe.exec(source)) !== null) {
    if (hasForbiddenWord(m[2])) {
      push(m.index, `localStorage[${m[2]}] assignment may store secret material`);
    }
  }

  return violations;
}

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      results.push(...walk(full));
    } else if (SCAN_EXTENSIONS.has(extname(full))) {
      results.push(full);
    }
  }
  return results;
}

export function scanDirectory(dir) {
  const allViolations = [];
  for (const file of walk(dir)) {
    const source = readFileSync(file, 'utf8');
    allViolations.push(...findViolations(source, file));
  }
  return allViolations;
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const srcDir = join(root, 'src');
  const violations = scanDirectory(srcDir);
  if (violations.length === 0) {
    console.log('storage-guard: OK — no secret material written to localStorage.');
    process.exit(0);
  }
  console.error('storage-guard: FAIL — secret material must never be written to localStorage.');
  for (const v of violations) {
    console.error(`  ${relative(root, v.file)}:${v.line}:${v.column}  ${v.message}`);
  }
  console.error(
    '\nStore secrets (keys, seeds, signatures, passwords) in sessionStorage or in-memory state.\n' +
      'The only wallet value allowed in localStorage is the last-connected *public address*.',
  );
  process.exit(1);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}

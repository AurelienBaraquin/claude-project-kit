#!/usr/bin/env node
// Deterministic documentation checks. Zero dependencies, run from the repository root:
//   node scripts/check-docs.mjs [rootDir]      (or --version)
//
// 1. every relative Markdown link resolves to an existing file or directory
// 2. every inline-code path cited (a file path or a directory ending in `/`) in the "path documents" (CLAUDE.md, docs/architecture.md by
//    default) exists — this is what catches renamed or deleted files the docs still mention
// 3. ADR files are numbered without gaps or duplicates, carry a valid Status line, and a
//    "Superseded by ADR-NNNN" status points to an ADR that exists
//
// Optional `.docs-check.json` at the root:
//   { "ignore": ["legacy/"], "pathDocs": ["CLAUDE.md"], "adrDir": "docs/adr",
//     "ignorePaths": ["^org/repo$"] }
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Never part of the project: excluded from the file index and from scanning.
const NEVER_INDEXED = ['node_modules/', '.git/', 'dist/', 'build/', 'coverage/'];
const DEFAULTS = {
  // Extra locations whose Markdown is not scanned (they stay in the index, so links to them work).
  ignore: [],
  pathDocs: ['CLAUDE.md', 'docs/architecture.md'],
  adrDir: 'docs/adr',
  ignorePaths: [],
};
// Bumped when behaviour changes; project-sync compares it with a project's copy.
export const VERSION = '1.0.0';

const ADR_FILE = /^(\d{4})-.+\.md$/;
const ADR_STATUS = /^- \*\*Status\*\*:\s*(.+)$/m;
const VALID_STATUS = /^(Proposed|Accepted|Deprecated|Superseded by ADR-(\d{4}))\b/;

export function loadConfig(root) {
  const file = path.join(root, '.docs-check.json');
  const user = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  return { ...DEFAULTS, ...user };
}

function listFiles(root, ignore) {
  const isIgnored = (rel) => ignore.some((prefix) => rel.startsWith(prefix));
  try {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').filter((rel) => rel && !isIgnored(rel));
  } catch {
    return walk(root, '', isIgnored);
  }
}

function walk(root, rel, isIgnored) {
  const found = [];
  for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (isIgnored(entry.isDirectory() ? `${child}/` : child)) continue;
    if (entry.isDirectory()) found.push(...walk(root, child, isIgnored));
    else found.push(child);
  }
  return found;
}

/** Every file and every directory of the project, as root-relative POSIX paths. */
function buildIndex(files) {
  const index = new Set();
  for (const file of files) {
    const parts = file.split('/');
    for (let end = 1; end <= parts.length; end += 1) index.add(parts.slice(0, end).join('/'));
  }
  return index;
}

/** Exact match, or a suffix match for documents that cite paths relative to a section's folder. */
function inIndex(index, token) {
  const clean = token.replace(/^\.\//, '').replace(/\/$/, '');
  if (index.has(clean)) return true;
  for (const known of index) if (known.endsWith(`/${clean}`)) return true;
  return false;
}

/** Lines outside fenced code blocks, with their 1-based numbers. */
function proseLines(text) {
  let inFence = false;
  const lines = [];
  text.split('\n').forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) lines.push({ line, number: index + 1 });
  });
  return lines;
}

export function checkLinks(index, file, text) {
  const problems = [];
  const dir = path.posix.dirname(file);
  for (const { line, number } of proseLines(text)) {
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1];
      if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
      const clean = decodeURIComponent(target.split('#')[0].split('?')[0]);
      if (!clean) continue;
      const resolved = path.posix.normalize(
        clean.startsWith('/') ? clean.slice(1) : path.posix.join(dir, clean),
      );
      // Links that climb above the root are host-relative (e.g. GitHub's ../../issues/1).
      if (resolved.startsWith('..')) continue;
      if (!index.has(resolved.replace(/\/$/, '') || '.') && resolved !== '.') {
        problems.push(`${file}:${number}: broken link -> ${target}`);
      }
    }
  }
  return problems;
}

const NOT_A_PATH = /[\s*{}<>$:=()…|\\^!@,;'"]/;

/** A token is path-like if it has a slash and ends with a file extension or a trailing slash. */
function citedPaths(line) {
  const tokens = [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  return tokens.filter(
    (token) =>
      token.includes('/') &&
      /(\.[A-Za-z0-9]+|\/)$/.test(token) &&
      !token.startsWith('/') &&
      !token.startsWith('~') &&
      !token.startsWith('-') &&
      !NOT_A_PATH.test(token) &&
      !/^[a-z][a-z0-9+.-]*:\/\//i.test(token),
  );
}

export function checkCitedPaths(index, file, text, ignorePatterns) {
  const problems = [];
  const ignored = ignorePatterns.map((pattern) => new RegExp(pattern));
  for (const { line, number } of proseLines(text)) {
    for (const token of citedPaths(line)) {
      if (ignored.some((pattern) => pattern.test(token))) continue;
      const relative = /^\.{1,2}\//.test(token)
        ? path.posix.normalize(path.posix.join(path.posix.dirname(file), token))
        : token;
      if (!inIndex(index, relative)) {
        problems.push(`${file}:${number}: cited path does not exist -> ${token}`);
      }
    }
  }
  return problems;
}

export function checkAdrs(root, adrDir) {
  const dir = path.join(root, adrDir);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const problems = [];
  const adrs = readdirSync(dir)
    .map((name) => ({ name, match: ADR_FILE.exec(name) }))
    .filter(({ match }) => match && match[1] !== '0000')
    .map(({ name, match }) => ({ name, number: Number(match[1]) }))
    .sort((a, b) => a.number - b.number);
  const numbers = new Set(adrs.map(({ number }) => number));

  adrs.forEach(({ name, number }, index) => {
    const rel = `${adrDir}/${name}`;
    if (index > 0 && adrs[index - 1].number === number) {
      problems.push(`${rel}: duplicate ADR number ${number}`);
    } else if (number !== index + 1) {
      problems.push(`${rel}: ADR numbering has a gap (expected ${index + 1}, found ${number})`);
    }
    const text = readFileSync(path.join(dir, name), 'utf8');
    const heading = /^# ADR-(\d{4})\b/m.exec(text);
    if (!heading || Number(heading[1]) !== number) {
      problems.push(`${rel}: title must start with "# ADR-${String(number).padStart(4, '0')}"`);
    }
    const status = ADR_STATUS.exec(text);
    const valid = status && VALID_STATUS.exec(status[1].trim());
    if (!valid) {
      problems.push(`${rel}: missing or invalid "- **Status**:" line`);
    } else if (valid[2] && !numbers.has(Number(valid[2]))) {
      problems.push(`${rel}: superseded by ADR-${valid[2]} which does not exist`);
    }
  });
  return problems;
}

export function run(root) {
  const config = loadConfig(root);
  const files = listFiles(root, NEVER_INDEXED);
  const index = buildIndex(files);
  const problems = [];
  const isScanned = (rel) =>
    rel.endsWith('.md') && !config.ignore.some((prefix) => rel.startsWith(prefix));
  for (const file of files.filter(isScanned)) {
    const text = readFileSync(path.join(root, file), 'utf8');
    problems.push(...checkLinks(index, file, text));
    if (config.pathDocs.includes(file)) {
      problems.push(...checkCitedPaths(index, file, text, config.ignorePaths));
    }
  }
  problems.push(...checkAdrs(root, config.adrDir));
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--version') {
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
  }
  const root = path.resolve(process.argv[2] ?? '.');
  const problems = run(root);
  if (problems.length > 0) {
    process.stderr.write(`${problems.join('\n')}\n\n${problems.length} documentation problem(s)\n`);
    process.exit(1);
  }
  process.stdout.write('docs-check: no problem found\n');
}

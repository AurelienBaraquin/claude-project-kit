#!/usr/bin/env node
// Read-only reconnaissance of an existing project. Prints a Markdown "facts sheet": what the
// repository contains and how it has evolved, with no interpretation. Zero dependencies.
//   node recon.mjs [rootDir]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const VERSION = '1.0.0';

const NEVER_INDEXED = ['node_modules/', '.git/', 'dist/', 'build/', 'coverage/', '.venv/', 'target/'];
const MANIFESTS = new Set([
  'package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'go.mod', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'Gemfile', 'composer.json', 'Makefile',
  'CMakeLists.txt', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yaml',
]);
const CI_FILES = [
  /^\.github\/workflows\//, /^\.gitlab-ci\.yml$/, /^Jenkinsfile$/, /^\.circleci\//,
  /^azure-pipelines\.yml$/,
];
const DOC_FILES = [
  /^README/i, /^CLAUDE\.md$/, /^CONTRIBUTING/i, /^LICENSE/i, /^docs\//, /(^|\/)\.env\.(example|sample)$/,
];
const NOT_CODE = new Set([
  'lock', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'pdf', 'map', 'zip',
]);
const LOCKFILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|go\.sum)$/;
const CONVENTIONAL = /^(feat|fix|chore|docs|test|refactor|ci|perf|build|revert|style)(\([^)]*\))?!?: /;
const MARKER = 'TODO|FIXME|HACK|XXX';

function git(root, args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 128 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

function walk(root, rel = '') {
  const found = [];
  for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (NEVER_INDEXED.some((prefix) => `${child}/`.startsWith(prefix))) continue;
    if (entry.isDirectory()) found.push(...walk(root, child));
    else found.push(child);
  }
  return found;
}

const top = (counts, limit) =>
  [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);

function tally(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

function gitFacts(root, tracked) {
  const commits = git(root, ['rev-list', '--count', 'HEAD']);
  if (commits === null) return { isRepo: false };

  const subjects = (git(root, ['log', '-100', '--format=%s']) ?? '').split('\n').filter(Boolean);
  const touched = (git(root, ['log', '-200', '--name-only', '--format=']) ?? '')
    .split('\n')
    .filter((file) => file && tracked.has(file) && !LOCKFILE.test(file));
  const shortlog = (git(root, ['shortlog', '-sn', '--no-merges', 'HEAD']) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.trim().split(/\s+/, 2).concat(line.trim().replace(/^\d+\s+/, '')))
    .map(([count, , name]) => ({ count: Number(count), name }));

  return {
    isRepo: true,
    branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    clean: git(root, ['status', '--porcelain']) === '',
    commits: Number(commits),
    firstCommit: (git(root, ['log', '--max-parents=0', '--format=%aI']) ?? '').split('\n')[0] || null,
    lastCommit: git(root, ['log', '-1', '--format=%aI']),
    authors: shortlog.length,
    topAuthors: shortlog.slice(0, 5),
    conventional: { count: subjects.filter((s) => CONVENTIONAL.test(s)).length, of: subjects.length },
    hotspots: top(tally(touched), 10),
    remotes: (git(root, ['remote', '-v']) ?? '').split('\n').filter((l) => l.endsWith('(fetch)')),
  };
}

function markerFacts(root) {
  const out = git(root, ['grep', '-cIE', MARKER]);
  if (!out) return { total: 0, files: [] };
  const rows = out.split('\n').map((line) => {
    const at = line.lastIndexOf(':');
    return [line.slice(0, at), Number(line.slice(at + 1))];
  });
  return {
    total: rows.reduce((sum, [, n]) => sum + n, 0),
    files: rows.sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

function manifestFacts(root, files) {
  return files
    .filter((file) => MANIFESTS.has(path.posix.basename(file)) && file.split('/').length <= 4)
    .map((file) => {
      const base = { path: file };
      if (path.posix.basename(file) !== 'package.json') return base;
      try {
        const pkg = JSON.parse(readFileSync(path.join(root, file), 'utf8'));
        return {
          ...base,
          name: pkg.name,
          type: pkg.type,
          workspaces: pkg.workspaces,
          engines: pkg.engines,
          scripts: Object.keys(pkg.scripts ?? {}),
          dependencies: Object.keys(pkg.dependencies ?? {}).length,
          devDependencies: Object.keys(pkg.devDependencies ?? {}).length,
        };
      } catch {
        return { ...base, unreadable: true };
      }
    });
}

export function collect(root) {
  const listed = git(root, ['ls-files', '-co', '--exclude-standard']);
  const files = (listed === null ? walk(root) : listed.split('\n').filter(Boolean)).filter(
    (file) => !NEVER_INDEXED.some((prefix) => file.startsWith(prefix)),
  );
  const tracked = new Set(files);
  const extensions = files
    .map((file) => path.posix.extname(file).slice(1).toLowerCase())
    .filter((ext) => ext && !NOT_CODE.has(ext));
  const testFiles = files.filter(
    (file) => /(^|\/)(tests?|__tests__|spec|e2e)\//i.test(file) || /\.(test|spec)\.[a-z]+$/i.test(file),
  );

  return {
    root: path.resolve(root),
    date: new Date().toISOString().slice(0, 10),
    git: gitFacts(root, tracked),
    fileCount: files.length,
    extensions: top(tally(extensions), 8),
    topLevel: top(tally(files.map((file) => (file.includes('/') ? file.split('/')[0] : '(root files)'))), 12),
    manifests: manifestFacts(root, files),
    ci: files.filter((file) => CI_FILES.some((pattern) => pattern.test(file))),
    docs: files.filter((file) => DOC_FILES.some((pattern) => pattern.test(file))),
    trackedEnv: files.filter(
      (file) => /(^|\/)\.env(\.|$)/.test(file) && !/\.(example|sample|template)$/.test(file),
    ),
    tests: { count: testFiles.length, directories: top(tally(testFiles.map((f) => path.posix.dirname(f))), 5) },
    markers: markerFacts(root),
  };
}

const list = (items) => (items.length === 0 ? '- none' : items.map((item) => `- ${item}`).join('\n'));
const pairs = (rows) => list(rows.map(([name, count]) => `${name} (${count})`));

export function render(facts) {
  const lines = [
    '# Facts sheet',
    '',
    `Produced by \`recon.mjs\` on ${facts.date}. Facts only — nothing here is interpreted.`,
    '',
    '## Git',
  ];
  const g = facts.git;
  if (!g.isRepo) {
    lines.push('- not a git repository (no history available)');
  } else {
    lines.push(
      `- branch \`${g.branch}\`, working tree ${g.clean ? 'clean' : 'has uncommitted changes'}`,
      `- ${g.commits} commits by ${g.authors} author(s), from ${g.firstCommit ?? 'unknown'} to ${g.lastCommit ?? 'unknown'}`,
      `- Conventional Commits in the last ${g.conventional.of} commits: ${g.conventional.count}`,
      `- remotes: ${g.remotes.length === 0 ? 'none' : g.remotes.join(' | ')}`,
      `- top authors: ${g.topAuthors.map((a) => `${a.name} (${a.count})`).join(', ') || 'none'}`,
      '',
      '### Most changed files (last 200 commits)',
      pairs(g.hotspots),
    );
  }
  lines.push(
    '',
    `## Files — ${facts.fileCount} tracked or untracked-not-ignored`,
    '### By extension',
    pairs(facts.extensions),
    '### Top-level folders',
    pairs(facts.topLevel),
    '',
    '## Manifests and build files',
    list(
      facts.manifests.map((m) => {
        if (!m.scripts) return `\`${m.path}\``;
        const detail = [
          m.name && `name ${m.name}`,
          m.type && `type ${m.type}`,
          m.workspaces && 'workspaces',
          m.engines && `engines ${JSON.stringify(m.engines)}`,
          `scripts: ${m.scripts.join(', ') || 'none'}`,
          `${m.dependencies} dependencies, ${m.devDependencies} dev`,
        ].filter(Boolean);
        return `\`${m.path}\` — ${detail.join('; ')}`;
      }),
    ),
    '',
    '## CI',
    list(facts.ci.map((file) => `\`${file}\``)),
    '',
    '## Documentation present',
    list(facts.docs.map((file) => `\`${file}\``)),
    '',
    `## Tests — ${facts.tests.count} test file(s)`,
    pairs(facts.tests.directories),
    '',
    `## TODO / FIXME / HACK / XXX markers — ${facts.markers.total}`,
    pairs(facts.markers.files),
    '',
    '## Risks visible without reading code',
    list(
      facts.trackedEnv.map((file) => `\`${file}\` is tracked by git — may contain secrets`),
    ),
  );
  return `${lines.join('\n')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--version') {
    process.stdout.write(`${VERSION}\n`);
  } else {
    process.stdout.write(render(collect(path.resolve(process.argv[2] ?? '.'))));
  }
}

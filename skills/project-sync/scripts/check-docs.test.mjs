import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { VERSION, readIndex, run, runAll } from './check-docs.mjs';

let root;

function put(rel, content = '') {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

const adr = (number, status = 'Accepted') =>
  `# ADR-${String(number).padStart(4, '0')} — title\n\n- **Status**: ${status}\n`;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'check-docs-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('links', () => {
  it('accepts links that resolve and ignores external ones and anchors', () => {
    put('README.md', '[a](docs/a.md) [b](https://x.dev) [c](#top) [d](docs/a.md#intro)');
    put('docs/a.md', '# a');
    assert.deepEqual(run(root), []);
  });

  it('reports a broken relative link with file and line', () => {
    put('README.md', 'ok\n[a](docs/missing.md)');
    assert.deepEqual(run(root), ['README.md:2: broken link -> docs/missing.md']);
  });

  it('resolves links relative to the containing file', () => {
    put('docs/a.md', '[up](../README.md)');
    put('README.md', '# r');
    assert.deepEqual(run(root), []);
  });

  it('skips host-relative links that climb above the repository root', () => {
    put('.assistant/backlog.md', '[issue](../../../../issues/58)');
    assert.deepEqual(run(root), []);
  });

  it('does not scan ignored locations but still lets other documents link to them', () => {
    put('.docs-check.json', JSON.stringify({ ignore: ['legacy/'] }));
    put('legacy/old.md', '[gone](missing.md)');
    put('README.md', '[old](legacy/old.md)');
    assert.deepEqual(run(root), []);
  });

  it('ignores links inside fenced code blocks', () => {
    put('README.md', '```\n[a](nope.md)\n```');
    assert.deepEqual(run(root), []);
  });
});

describe('cited paths', () => {
  it('flags a path in CLAUDE.md that no longer exists', () => {
    put('CLAUDE.md', 'Edit `src/app.ts` and `src/app.module.ts`.');
    put('src/app.module.ts');
    assert.deepEqual(run(root), ['CLAUDE.md:1: cited path does not exist -> src/app.ts']);
  });

  it('accepts directories and ignores globs, urls, commands and absolute routes', () => {
    put('docs/architecture.md', '`src/` `src/**/*.ts` `/api/health` `npm run a/b` `https://x/y`');
    put('src/index.ts');
    assert.deepEqual(run(root), []);
  });

  it('accepts paths cited relative to a section folder (suffix match)', () => {
    put('CLAUDE.md', 'See `auth/auth.service.ts` and `auth/`.');
    put('services/api/src/auth/auth.service.ts');
    assert.deepEqual(run(root), []);
  });

  it('resolves ./ and ../ paths relative to the citing document', () => {
    put('.assistant/log.md', '# log');
    put('docs/architecture.md', 'See `../.assistant/log.md` and `../.assistant/gone.md`.');
    assert.deepEqual(run(root), [
      'docs/architecture.md:1: cited path does not exist -> ../.assistant/gone.md',
    ]);
  });

  it('does not mistake branch names or N/A for paths', () => {
    put('CLAUDE.md', 'Branch `feat/US-1-login`, mark `N/A`, run `docs/adr`.');
    assert.deepEqual(run(root), []);
  });

  it('flags a cited directory that no longer exists', () => {
    put('CLAUDE.md', 'Migrations live in `services/api/migrations/`.');
    put('services/api/prisma/migrations/001.sql');
    assert.deepEqual(run(root), [
      'CLAUDE.md:1: cited path does not exist -> services/api/migrations/',
    ]);
  });

  it('only inspects the configured path documents', () => {
    put('notes.md', 'see `ghost/file.ts`');
    assert.deepEqual(run(root), []);
  });

  it('honours ignorePaths from .docs-check.json', () => {
    put('.docs-check.json', JSON.stringify({ ignorePaths: ['^org/image$'] }));
    put('CLAUDE.md', 'uses `org/image`');
    assert.deepEqual(run(root), []);
  });
});

describe('ADRs', () => {
  it('accepts a sequential, well-formed set', () => {
    put('docs/adr/0000-template.md', '# ADR-0000 — t');
    put('docs/adr/0001-a.md', adr(1, 'Superseded by ADR-0002'));
    put('docs/adr/0002-b.md', adr(2));
    assert.deepEqual(run(root), []);
  });

  it('reports a numbering gap', () => {
    put('docs/adr/0001-a.md', adr(1));
    put('docs/adr/0003-c.md', adr(3));
    assert.deepEqual(run(root), [
      'docs/adr/0003-c.md: ADR numbering has a gap (expected 2, found 3)',
    ]);
  });

  it('reports a duplicate number', () => {
    put('docs/adr/0001-a.md', adr(1));
    put('docs/adr/0001-b.md', adr(1));
    assert.ok(run(root).some((problem) => problem.includes('duplicate ADR number 1')));
  });

  it('reports a missing status and a dangling supersede target', () => {
    put('docs/adr/0001-a.md', '# ADR-0001 — a\n');
    put('docs/adr/0002-b.md', adr(2, 'Superseded by ADR-0009'));
    assert.deepEqual(run(root), [
      'docs/adr/0001-a.md: missing or invalid "- **Status**:" line',
      'docs/adr/0002-b.md: superseded by ADR-0009 which does not exist',
    ]);
  });

  it('reports a title that does not match the file number', () => {
    put('docs/adr/0001-a.md', adr(2));
    assert.deepEqual(run(root), ['docs/adr/0001-a.md: title must start with "# ADR-0001"']);
  });
});

describe('version', () => {
  it('prints a semantic version with --version, matching the exported constant', () => {
    const script = fileURLToPath(new URL('./check-docs.mjs', import.meta.url));
    const printed = execFileSync(process.execPath, [script, '--version'], { encoding: 'utf8' });
    assert.match(VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(printed.trim(), VERSION);
  });
});

describe('run through a symlinked skill folder', () => {
  it('still executes and reports problems with a non-zero exit code', () => {
    const scripts = path.dirname(fileURLToPath(import.meta.url));
    const link = path.join(root, 'linked-scripts');
    symlinkSync(scripts, link);
    put('CLAUDE.md', 'See `ghost/file.ts`.');
    let status = 0;
    try {
      execFileSync(process.execPath, [path.join(link, 'check-docs.mjs'), root], { stdio: 'pipe' });
    } catch (error) {
      status = error.status;
    }
    assert.equal(status, 1);
    const version = execFileSync(process.execPath, [path.join(link, 'check-docs.mjs'), '--version'], { encoding: 'utf8' });
    assert.equal(version.trim(), VERSION);
  });
});

const HEAD = '| Document | What it answers | Covers | Update when |\n|---|---|---|---|\n';
const indexOf = (...rows) => `# Index\n\n${HEAD}${rows.join('\n')}\n`;
const row = (doc, covers) => `| [${doc}](${doc}) | what | ${covers} | when |`;
const config = (value) => put('.docs-check.json', JSON.stringify(value));

describe('the documentation index', () => {
  it('reads each row with its document path and covered paths', () => {
    put('docs/README.md', indexOf(row('api.md', '`src/routes/` `openapi.yaml`'), '| [adr/](adr/) | why | decisions | when |'));
    assert.deepEqual(readIndex(root, 'docs/README.md'), [
      { doc: 'docs/api.md', covers: ['src/routes/', 'openapi.yaml'] },
      { doc: 'docs/adr/', covers: [] },
    ]);
  });

  it('is ignored when the table has no Covers column', () => {
    put('docs/README.md', '| A | B |\n|---|---|\n| [x](x.md) | y |\n');
    assert.equal(readIndex(root, 'docs/README.md'), null);
  });
});

describe('coverage', () => {
  it('is inactive without an index', () => {
    put('Dockerfile', 'FROM node');
    put('src/a.js', 'x');
    assert.deepEqual(runAll(root).errors, []);
  });

  it('is inactive when the index has no Covers column', () => {
    put('docs/README.md', '| A | B |\n|---|---|\n| [x](x.md) | y |\n');
    put('docs/x.md', '# x');
    put('Dockerfile', 'FROM node');
    assert.deepEqual(runAll(root).errors, []);
  });

  it('reports a surface that no document covers', () => {
    put('docs/README.md', indexOf(row('api.md', '`src/`')));
    put('docs/api.md', '# api');
    put('src/a.js', 'x');
    put('Dockerfile', 'FROM node');
    assert.deepEqual(runAll(root).errors, ['docs/README.md: deployment not covered by any document -> Dockerfile']);
  });

  it('accepts literal paths, ancestor directories, descendants and globs', () => {
    put('docs/README.md', indexOf(row('a.md', '`Dockerfile` `infra/`'), row('b.md', '`src/**/*.ts` `lib/util/`')));
    put('docs/a.md', '# a');
    put('docs/b.md', '# b');
    put('Dockerfile', 'FROM node');
    put('infra/docker-compose.yml', 'services: {}');
    put('src/routes/r.ts', 'x');
    put('lib/util/u.js', 'x');
    assert.deepEqual(runAll(root).errors, []);
  });

  it('recognises CI, configuration, API contract and migration surfaces', () => {
    put('docs/README.md', indexOf(row('a.md', '`.github/workflows/` `db/`')));
    put('docs/a.md', '# a');
    put('.github/workflows/ci.yml', 'name: ci');
    put('db/migrations/001.sql', 'select 1');
    put('.env.example', 'A=');
    put('api/openapi.yaml', 'openapi: 3');
    assert.deepEqual(runAll(root).errors.sort(), [
      'docs/README.md: API contract not covered by any document -> api/openapi.yaml',
      'docs/README.md: configuration not covered by any document -> .env.example',
      'docs/README.md: top-level folder not covered by any document -> api/',
    ]);
  });

  it('recognises web-server, platform and infrastructure-as-code files as deployment', () => {
    put('docs/README.md', indexOf(row('a.md', '`README.md`')));
    put('docs/a.md', '# a');
    put('nginx.conf', 'events {}');
    put('fly.toml', 'app = "x"');
    put('main.tf', 'terraform {}');
    assert.deepEqual(runAll(root).errors.sort(), [
      'docs/README.md: deployment not covered by any document -> fly.toml',
      'docs/README.md: deployment not covered by any document -> main.tf',
      'docs/README.md: deployment not covered by any document -> nginx.conf',
    ]);
  });

  it('does not require docs/ or dot-directories to be covered', () => {
    put('docs/README.md', indexOf(row('a.md', '`src/`')));
    put('docs/a.md', '# a');
    put('src/a.js', 'x');
    put('.assistant/log.md', 'x');
    put('.claude/settings.json', '{}');
    assert.deepEqual(runAll(root).errors, []);
  });

  it('honours coverageIgnore and the warn and off levels', () => {
    put('docs/README.md', indexOf(row('a.md', '`src/`')));
    put('docs/a.md', '# a');
    put('src/a.js', 'x');
    put('scripts/build.js', 'x');
    config({ coverageIgnore: ['scripts/'] });
    assert.deepEqual(runAll(root).errors, []);
    config({ coverage: 'warn' });
    const warn = runAll(root);
    assert.deepEqual(warn.errors, []);
    assert.deepEqual(warn.warnings, ['docs/README.md: top-level folder not covered by any document -> scripts/']);
    config({ coverage: 'off' });
    assert.deepEqual(runAll(root), { errors: [], warnings: [], docsIndex: 'docs/README.md' });
  });

  it('rejects an invalid level in .docs-check.json', () => {
    config({ coverage: 'strict' });
    assert.throws(() => runAll(root), /"coverage" must be one of error, warn, off/);
  });
});

describe('freshness', () => {
  const identity = {
    GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@e.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@e.com',
  };
  const git = (...args) => execFileSync('git', args, { cwd: root, env: { ...process.env, ...identity } });
  const commit = (message) => {
    git('add', '-A');
    git('commit', '-qm', message);
  };
  const touchCode = (times) => {
    for (let n = 0; n < times; n += 1) {
      put('src/routes/a.js', `v${n}-${Math.random()}`);
      commit(`feat: change ${n}`);
    }
  };
  const staleWarning = (count) => [`docs/api.md: possibly stale — ${count} commit(s) touched \`src/routes/\` since this document last changed`];

  beforeEach(() => {
    git('init', '-q', '-b', 'main');
    put('docs/README.md', indexOf(row('api.md', '`src/routes/`')));
    put('docs/api.md', '# api');
    put('src/routes/a.js', 'v');
    commit('docs: initial');
  });

  it('warns when the covered paths changed in several commits after the document', () => {
    touchCode(3);
    const result = runAll(root);
    assert.deepEqual(result.warnings, staleWarning(3));
    assert.deepEqual(result.errors, []);
  });

  it('stays quiet below the threshold', () => {
    touchCode(2);
    assert.deepEqual(runAll(root).warnings, []);
  });

  it('stays quiet once the document has been updated again', () => {
    touchCode(4);
    put('docs/api.md', '# api updated');
    commit('docs: update api');
    assert.deepEqual(runAll(root).warnings, []);
  });

  it('stays quiet while the document has uncommitted changes', () => {
    touchCode(4);
    put('docs/api.md', '# api being edited');
    assert.deepEqual(runAll(root).warnings, []);
  });

  it('follows glob patterns and a custom threshold', () => {
    put('docs/README.md', indexOf(row('api.md', '`src/**/*.js`')));
    commit('docs: glob');
    config({ staleAfterCommits: 1 });
    commit('chore: config');
    touchCode(1);
    assert.equal(runAll(root).warnings.length, 1);
  });

  it('can be an error or switched off', () => {
    touchCode(3);
    config({ freshness: 'error' });
    assert.equal(runAll(root).errors.length, 1);
    config({ freshness: 'off' });
    assert.deepEqual(runAll(root), { errors: [], warnings: [], docsIndex: 'docs/README.md' });
  });
});

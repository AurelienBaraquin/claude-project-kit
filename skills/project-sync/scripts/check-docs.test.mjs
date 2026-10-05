import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { VERSION, run } from './check-docs.mjs';

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

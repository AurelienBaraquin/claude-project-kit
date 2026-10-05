import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { VERSION, adrIndex, collect, datedEntries, docsIndex, openQuestions, render } from './context-pack.mjs';

let root;

const identity = {
  GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@e.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@e.com',
};

function put(rel, content = '') {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'pack-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('a project with a foundation', () => {
  beforeEach(() => {
    put('CLAUDE.md', '# CLAUDE.md\n\n## 6. Open questions\n\n- Which cloud provider?\n- Lint or not?\n\n## 7. Other\n- ignored\n');
    put('docs/brief.md', '# Brief\n\n## Open questions\n\n- None yet.\n');
    put('docs/architecture.md', '# Architecture\n');
    put('docs/README.md', '# Index\n\n| Document | What it answers | Covers | Update when |\n|---|---|---|---|\n| [api.md](api.md) | The HTTP API | `src/routes/` | a route changes |\n| [adr/](adr/) | Why | decisions | a decision is made |\n');
    put('docs/adr/0000-template.md', '# ADR-0000 — t');
    put('docs/adr/0001-use-postgres.md', '# ADR-0001 — Use PostgreSQL\n\n- **Status**: Accepted\n');
    put('docs/adr/0002-queue.md', '# ADR-0002 — Add a queue\n\n- **Status**: Superseded by ADR-0003\n');
    put('.assistant/decisions-log.md', '# Decisions log\n\nFormat blah.\n\n2026-01-01 — chose X — why\n2026-02-01 — chose Y — why\n');
    put('.assistant/lessons.md', '# Lessons\n\n2026-03-01 — broke Z — caught by CI — test added\n');
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'docs: foundations'], { cwd: root, env: { ...process.env, ...identity } });
  });

  it('lists foundation documents with their presence', () => {
    const pack = collect(root);
    const byPath = Object.fromEntries(pack.foundation.map((f) => [f.path, f.present]));
    assert.equal(byPath['CLAUDE.md'], true);
    assert.equal(byPath['.assistant/takeover-report.md'], false);
  });

  it('indexes ADRs with title and status, skipping the template', () => {
    assert.deepEqual(adrIndex(root), [
      { file: 'docs/adr/0001-use-postgres.md', title: 'Use PostgreSQL', status: 'Accepted' },
      { file: 'docs/adr/0002-queue.md', title: 'Add a queue', status: 'Superseded by ADR-0003' },
    ]);
  });

  it('reads the documentation index rows', () => {
    assert.deepEqual(docsIndex(root), [
      { name: 'api.md', file: 'api.md', answers: 'The HTTP API', covers: '`src/routes/`' },
      { name: 'adr/', file: 'adr/', answers: 'Why', covers: 'decisions' },
    ]);
  });

  it('returns the latest dated entries only', () => {
    assert.deepEqual(datedEntries(root, '.assistant/decisions-log.md', 1), ['2026-02-01 — chose Y — why']);
  });

  it('reads the open questions section and stops at the next heading', () => {
    assert.deepEqual(openQuestions(root, 'CLAUDE.md'), ['Which cloud provider?', 'Lint or not?']);
  });

  it('reports git state', () => {
    const { git } = collect(root);
    assert.equal(git.branch, 'main');
    assert.equal(git.uncommitted, 0);
    assert.match(git.recent[0], /docs: foundations/);
  });

  it('renders a pack with the reading order and the ADR status', () => {
    const text = render(collect(root));
    assert.match(text, /^# Context pack/);
    assert.match(text, /`CLAUDE.md` \(\d+ lines\)/);
    assert.match(text, /\[Superseded by ADR-0003\]/);
    assert.match(text, /Documentation index \(2\)/);
    assert.match(text, /`api.md` — The HTTP API/);
    assert.match(text, /no docs check installed/);
  });
});

describe('a project without any foundation', () => {
  it('says so and points to the init skills', () => {
    put('README.md', '# x');
    const text = render(collect(root));
    assert.match(text, /No foundation document found/);
    assert.match(text, /project-adopt/);
    assert.match(text, /not a git repository/);
  });
});

describe('docs health', () => {
  it('surfaces problems reported by the project docs check', () => {
    put('scripts/check-docs.mjs', "console.error('CLAUDE.md:1: broken link -> x.md'); process.exit(1);\n");
    assert.deepEqual(collect(root).health, { installed: true, problems: ['CLAUDE.md:1: broken link -> x.md'] });
  });
});

it('runs when reached through a symlinked skill folder', () => {
  const link = path.join(root, 'linked');
  symlinkSync(path.dirname(fileURLToPath(import.meta.url)), link);
  put('CLAUDE.md', '# c');
  const out = execFileSync(process.execPath, [path.join(link, 'context-pack.mjs'), root], { encoding: 'utf8' });
  assert.match(out, /^# Context pack/);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

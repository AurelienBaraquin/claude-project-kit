import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { VERSION, collect, render } from './recon.mjs';

let root;

const identity = {
  GIT_AUTHOR_NAME: 'Dev',
  GIT_AUTHOR_EMAIL: 'dev@example.com',
  GIT_COMMITTER_NAME: 'Dev',
  GIT_COMMITTER_EMAIL: 'dev@example.com',
};

function put(rel, content = '') {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function commit(message) {
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-qm', message], { cwd: root, env: { ...process.env, ...identity } });
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'recon-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('a git project', () => {
  beforeEach(() => {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    put('package.json', JSON.stringify({ name: 'demo', type: 'module', scripts: { test: 'x', start: 'y' }, dependencies: { a: '1' } }));
    put('src/app.js', '// TODO: handle errors\nexport const a = 1;\n');
    put('src/app.test.js', 'x');
    put('README.md', '# demo');
    put('.env', 'SECRET=1');
    put('.env.example', 'SECRET=');
    put('.github/workflows/ci.yml', 'name: ci');
    commit('feat: first');
    put('src/app.js', 'export const a = 2;\n');
    commit('fix: second');
    put('src/app.js', 'export const a = 3;\n');
    commit('whatever');
  });

  it('collects history facts', () => {
    const { git } = collect(root);
    assert.equal(git.isRepo, true);
    assert.equal(git.branch, 'main');
    assert.equal(git.clean, true);
    assert.equal(git.commits, 3);
    assert.equal(git.authors, 1);
    assert.deepEqual(git.conventional, { count: 2, of: 3 });
    assert.equal(git.hotspots[0][0], 'src/app.js');
  });

  it('leaves lockfiles out of the most changed files', () => {
    for (const n of [1, 2, 3, 4]) {
      put('package-lock.json', `{"n":${n}}`);
      commit(`chore: lock ${n}`);
    }
    const names = collect(root).git.hotspots.map(([file]) => file);
    assert.ok(!names.includes('package-lock.json'));
    assert.ok(names.includes('src/app.js'));
  });

  it('collects structure facts', () => {
    const facts = collect(root);
    const pkg = facts.manifests.find((m) => m.path === 'package.json');
    assert.deepEqual(pkg.scripts, ['test', 'start']);
    assert.equal(pkg.dependencies, 1);
    assert.deepEqual(facts.ci, ['.github/workflows/ci.yml']);
    assert.ok(facts.docs.includes('README.md'));
    assert.equal(facts.tests.count, 1);
  });

  it('flags a tracked .env file but not the example', () => {
    assert.deepEqual(collect(root).trackedEnv, ['.env']);
  });

  it('counts TODO markers on tracked content', () => {
    put('src/todo.js', '// FIXME later\n// HACK\n');
    commit('chore: add markers');
    assert.equal(collect(root).markers.total, 2);
  });

  it('renders a Markdown facts sheet', () => {
    const text = render(collect(root));
    assert.match(text, /^# Facts sheet/);
    assert.match(text, /3 commits by 1 author/);
    assert.match(text, /`\.env` is tracked by git/);
  });
});

describe('a directory that is not a git repository', () => {
  it('still reports files and says there is no history', () => {
    put('main.py', 'print(1)');
    put('requirements.txt', 'flask');
    const facts = collect(root);
    assert.equal(facts.git.isRepo, false);
    assert.equal(facts.fileCount, 2);
    assert.ok(facts.manifests.some((m) => m.path === 'requirements.txt'));
    assert.match(render(facts), /not a git repository/);
  });
});

it('exposes a semantic version', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

it('still prints the facts sheet when run through a symlinked skill folder', () => {
  const link = path.join(root, 'linked-scripts');
  symlinkSync(path.dirname(fileURLToPath(import.meta.url)), link);
  put('main.py', 'print(1)');
  const output = execFileSync(process.execPath, [path.join(link, 'recon.mjs'), root], { encoding: 'utf8' });
  assert.match(output, /^# Facts sheet/);
});

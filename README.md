# claude-project-kit

Three Claude Code skills that give an AI agent what it needs to work coherently on a project, and
keep that knowledge true as the project changes.

The idea comes from a school project where an AI produced consistent, high-quality code. What
made it work was not the amount of context but its **legibility** (a short map, written rules),
its **verifiability** (tests, CI, contract checks) and its **freshness** (decisions recorded when
they were taken). This kit makes that setup reproducible and, above all, *living*.

## The skills

| Skill | When | What it does |
|---|---|---|
| `project-init` | once, at the start (or when adopting an existing repo) | Interviews you, then generates a minimal v0: `CLAUDE.md`, `docs/architecture.md`, ADR template, decisions and lessons logs, PR/issue templates, commit hook, docs check |
| `adr-new` | every time a decision is made | Records it as an ADR or a dated log line, in the same change as the code |
| `project-sync` | before a PR, at the end of a session | Audits the docs against the code and fixes drift |

`project-init` never invents decisions: unknowns become *Open questions*. The generated
`CLAUDE.md` contains a **Living documentation protocol** that tells the agent it may — and
should — call `adr-new` and `project-sync` and edit the docs by itself from then on.

## Install

```bash
git clone <this repository> ~/claude-project-kit
~/claude-project-kit/install.sh            # symlinks into ~/.claude/skills
```

`git pull` then updates every machine. `--copy` copies instead of linking, `--uninstall` removes
what the script installed. Restart Claude Code (or start a new session) to load the skills.

## Use

In a project, ask Claude to run the skill, for example *"use project-init to set up this
project"*. Afterwards the protocol in `CLAUDE.md` makes the agent reach for `adr-new` and
`project-sync` on its own.

## What `project-init` can generate

`CLAUDE.md` · `docs/architecture.md` · `docs/adr/0000-template.md` · `.assistant/decisions-log.md` ·
`.assistant/lessons.md` · `.github/PULL_REQUEST_TEMPLATE.md` · `.github/ISSUE_TEMPLATE/user-story.md` ·
`.githooks/commit-msg` · `.githooks/pre-commit` · `.claude/settings.json` ·
`.claude/hooks/ensure-git-hooks.sh` · `.github/workflows/docs-check.yml` · `scripts/check-docs.mjs`

## Enforcement, not just instructions

Rules that must hold are enforced by mechanisms that travel with the repository:

- `commit-msg` rejects non-conforming commit messages and AI attribution lines;
- `pre-commit` runs the docs check, so drift is caught the moment it is introduced;
- `.claude/settings.json` hides AI attribution and wires `ensure-git-hooks.sh`, which makes
  Claude Code refuse `git commit` until `git config core.hooksPath .githooks` has been run in
  that clone (`project-init` runs it once).

## The docs check

`skills/project-sync/scripts/check-docs.mjs` is dependency-free (Node ≥ 18). It verifies relative
Markdown links, the paths cited in `CLAUDE.md` and `docs/architecture.md`, and ADR numbering and
status. Configure it with `.docs-check.json` (`ignore`, `pathDocs`, `adrDir`, `ignorePaths`).
`--version` prints its version; `project-sync` offers to update an older copy in a project. Known
limit: a directory cited without a trailing `/` is not checked.

```bash
node --test skills/project-sync/scripts/check-docs.test.mjs   # its tests
```

## Layout

```
skills/
  project-init/   SKILL.md · interview.md · rules-catalog.md · templates/
  adr-new/        SKILL.md
  project-sync/   SKILL.md · scripts/check-docs.mjs (+ tests)
install.sh
```

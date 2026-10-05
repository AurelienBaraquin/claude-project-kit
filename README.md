# claude-project-kit

Five Claude Code skills that give an AI agent what it needs to work coherently on a project, and
keep that knowledge true as the project changes.

The idea comes from a school project where an AI produced consistent, high-quality code. What
made it work was not the amount of context but its **legibility** (a short map, written rules),
its **verifiability** (tests, CI, contract checks) and its **freshness** (decisions recorded when
they were taken). This kit makes that setup reproducible and, above all, *living*.

## The skills

| Skill | When | What it does |
|---|---|---|
| `project-init` | once, at the start of a new (or near-empty) project | Takes what you said when launching it, interviews you for the rest, then generates a minimal v0: brief, `CLAUDE.md`, architecture, decision and lesson logs, templates, hooks, docs check |
| `project-adopt` | when taking over an existing codebase you did not write or have not touched for a while | Reconstructs what exists from the code and its history, measures a health baseline, confirms intent with you, then sets up the same foundation plus a dated takeover report |
| `project-onboard` | when an agent starts on a project it does not know (new session, teammate's agent, sub-agent) | Read-only. Reads the foundation documents in the right order, checks them against reality, and briefs the user in about 25 lines, then takes the mission you gave it |
| `adr-new` | every time a decision is made | Records it as an ADR or a dated log line, in the same change as the code |
| `project-sync` | before a PR, at the end of a session | Audits the docs against the code and the brief, and fixes drift |

```
new project ────▶ project-init  ─┐
                                  ├─▶ brief · CLAUDE.md · architecture · ADRs and logs · hooks
existing code ──▶ project-adopt ─┘
                                        when an agent arrives:  project-onboard  (context, then mission)
                                        while working:
                                        adr-new      at every decision
                                        project-sync before a PR, at the end of a session
```

The generated `CLAUDE.md` contains a **Living documentation protocol** telling the agent when to
call `adr-new` and `project-sync` and that it may edit the documentation by itself. Neither init
skill invents anything: what is unknown becomes an *Open question*.

## What the agent reads and writes

| File | Answers | Who changes it |
|---|---|---|
| `docs/brief.md` | **What** to build and why: purpose, users, scope in and out, priorities, success criteria, constraints | You decide. The agent proposes changes; each one is recorded with `adr-new`. Never edited silently |
| `CLAUDE.md` | **How** to work: a short map, hard rules, the living-documentation protocol | Rules come from the interview; the agent keeps the map true |
| `docs/architecture.md` | **How** it is built: layout, conventions, flows | The agent, in the same change as the code |
| `docs/adr/` · `.assistant/decisions-log.md` | **Why** it is built that way | `adr-new` |
| `.assistant/lessons.md` | Mistakes already made and what now prevents them | The agent, when review, CI or you catch one |
| `.assistant/takeover-report.md` | State of an adopted project on the day of takeover | `project-adopt` only; a snapshot, not maintained |

The project to build is described in the **brief**. It is fed by what you write when you launch
the skill, by any assignment or README it can read, and by the interview. So say what the project
is when you launch it: *"Use project-init: a CLI that tracks daily habits and shows streaks, solo,
learning project"* saves most of the questions.

## Cloud sessions and teammates

Skills installed in `~/.claude/skills` are **personal**: they load in every project on your
machine, but not in cloud sessions (claude.ai/code, mobile, `--cloud`, routines) nor on a
teammate's machine. A repository's own `.claude/skills/` is part of the clone, so it does. For a
project used that way, copy the day-to-day skills (`adr-new`, `project-sync`, `project-onboard`)
into it and commit them:

```bash
~/claude-project-kit/install.sh --project /path/to/repo          # day-to-day skills
~/claude-project-kit/install.sh --project /path/to/repo --all    # every skill
```

`project-init` proposes this during its interview, and `project-sync` reports copies that have
fallen behind the kit. `project-init` and `project-adopt` stay personal: they run once, locally.

## Install

```bash
git clone https://github.com/AurelienBaraquin/claude-project-kit ~/claude-project-kit
~/claude-project-kit/install.sh            # symlinks into ~/.claude/skills
```

`git pull` then updates every machine. `--copy` copies instead of linking, `--uninstall` removes
what the script installed. Restart Claude Code (or start a new session) to load the skills.

## Use

- **New project**: *"use project-init to set up this project"*, with a sentence on what it is.
- **Inherited or resumed project**: *"use project-adopt, I am taking this over to add features"*.
- **A new agent on a project that already has its foundation**: *"use project-onboard, then add
  pagination to the task list"*. The first part gives it the context, the rest is its mission.
- Afterwards you do not need to ask: the protocol in `CLAUDE.md` makes the agent reach for
  `adr-new` and `project-sync` on its own.

### project-init

- **Quick mode** (default for a small project): it settles everything the repository and sensible
  defaults can settle, then asks one round of at most 4 questions. **Thorough mode**: the full
  interview, in four phases (context, technical, process, rules for the agent).
- Rules in `CLAUDE.md` are copied from a catalogue of canonical sentences
  (`skills/project-init/rules-catalog.md`), so projects are consistent with each other. The
  exact text is shown to you before anything is written.
- Instead of fixed limits it asks for a **working mode** (plan once, step by step, in one go, or
  by risk) and the **actions that always need your confirmation**.
- Generates only what you chose: `docs/brief.md` · `CLAUDE.md` · `docs/architecture.md` ·
  `docs/adr/0000-template.md` · `.assistant/decisions-log.md` · `.assistant/lessons.md` ·
  `.github/PULL_REQUEST_TEMPLATE.md` · `.github/ISSUE_TEMPLATE/user-story.md` ·
  `.githooks/commit-msg` · `.githooks/pre-commit` · `.claude/settings.json` ·
  `.claude/hooks/ensure-git-hooks.sh` · `.github/workflows/docs-check.yml` ·
  `scripts/check-docs.mjs`

### project-adopt

1. Reads your launch prompt for the reason and goal of the takeover.
2. Runs `scripts/recon.mjs`, a read-only collector (history, structure, manifests and scripts, CI,
   tests, TODO markers, tracked `.env` files), then reads what it points to.
3. After your permission, runs the project's own build and tests to record a **health baseline**,
   without repairing anything.
4. Labels every finding *Fact*, *Inference* or *Unknown*, and never invents why something was done.
5. Asks only what the code cannot say (intent, status, off-limits areas, which observed
   conventions become rules), shows you the exact text to be written, then generates the same
   files as `project-init`, plus the takeover report. It changes documentation and tooling only,
   never source code.

### project-onboard

Read-only, so it is safe to run anywhere. It runs `scripts/context-pack.mjs` (which documents
exist, ADR index with status, latest decisions and lessons, open questions, git state, docs check
result), reads the core documents in full and the rest only as far as the mission needs, spot-checks
what it will rely on, then briefs you. It then follows the project's own working mode. If no
foundation document exists it says so and suggests `project-init` or `project-adopt`.

## Enforcement, not just instructions

Rules that must hold are enforced by mechanisms that travel with the repository:

- `commit-msg` rejects non-conforming commit messages and AI attribution lines;
- `pre-commit` runs the docs check, so drift is caught the moment it is introduced;
- `.claude/settings.json` hides AI attribution and wires `ensure-git-hooks.sh`, which makes
  Claude Code refuse `git commit` until `git config core.hooksPath .githooks` has been run in
  that clone (`project-init` runs it once).

## The scripts

All three are dependency-free (Node ≥ 18) and tested.

- `skills/project-sync/scripts/check-docs.mjs` verifies relative Markdown links, the paths cited
  in `CLAUDE.md` and `docs/architecture.md`, and ADR numbering and status. Configure it with
  `.docs-check.json` (`ignore`, `pathDocs`, `adrDir`, `ignorePaths`). `--version` prints its
  version, and `project-sync` offers to update an older copy in a project. Known limit: a
  directory cited without a trailing `/` is not checked.
- `skills/project-adopt/scripts/recon.mjs` prints the facts sheet used by `project-adopt`. It
  interprets nothing.
- `skills/project-onboard/scripts/context-pack.mjs` prints the snapshot used by
  `project-onboard`.

```bash
node --test skills/project-sync/scripts/check-docs.test.mjs
node --test skills/project-adopt/scripts/recon.test.mjs
node --test skills/project-onboard/scripts/context-pack.test.mjs
```

## Layout

```
skills/
  project-init/   SKILL.md · interview.md · rules-catalog.md · templates/
  project-adopt/  SKILL.md · scripts/recon.mjs (+ tests) · templates/takeover-report.md
  project-onboard/ SKILL.md · scripts/context-pack.mjs (+ tests)
  adr-new/        SKILL.md
  project-sync/   SKILL.md · scripts/check-docs.mjs (+ tests)
install.sh         personal install, or --project <dir> to copy skills into a repository
```

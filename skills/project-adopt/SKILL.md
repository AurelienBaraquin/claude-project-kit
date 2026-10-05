---
name: project-adopt
description: Take over an existing project you did not write or have not touched for a while — reconstruct what exists from the code and its history, establish a verified health baseline, confirm intent with the user, then set up CLAUDE.md, architecture.md, decision records and the working rules. Use when joining or inheriting a codebase, resuming an old project, or when a repository has substantial code but no map of it. For a new or near-empty project use project-init instead.
---

# project-adopt

`project-init` looks forward: it sets up foundations for a project that is starting. This skill
looks **backward**: the code already exists, its authors' intent is gone or forgotten, and you
must rebuild an accurate picture before anyone changes anything. The output is the same living
foundation (`CLAUDE.md`, `docs/architecture.md`, decisions, rules) plus a dated snapshot of the
project's state at takeover.

## Principles

1. **Evidence first.** Every statement about the code comes from a file, a command output or the
   git history you actually read. Label each finding **Fact** (verified, cite the path),
   **Inference** (reasoned, say from what) or **Unknown**. Never present an inference as a fact.
2. **Observed is not mandated.** A convention found in the code is a *candidate* rule. Only the
   user turns it into a rule.
3. **Rationale is not recoverable from code.** Never invent *why* something was done. A decision
   evident in the code is recorded as "rationale unknown" unless the user supplies the reason.
4. **Read-only on the code.** The takeover changes documentation and tooling files only — never
   source code. Do not fix what you find; report it.
5. **Ask only what the code cannot say**: intent, status, constraints, history, what to leave
   alone.
6. **Same discipline as `project-init`**: at most 4 questions per round, "(Recommended)" only
   with a stated reason, unchecked in a multi-select = the agent asks first, a "decide later"
   path that becomes an *Open question*, reflect back before writing, never overwrite silently.

## Procedure

### 1. The project and the goal
- Take what the user wrote when invoking the skill as the **first input**: why they are taking
  the project over, what they want to do with it (maintain, extend, modernise, learn it),
  constraints, deadlines. Extract it, show it back in the reflect-back step, and do not ask again
  for what was said.
- If the goal is missing, ask it first: fix and maintain · add features · modernise or rewrite
  parts · understand it · decide later.
- Read any document the user points to, and the existing `README` and `docs/`.
- Run `git status`. If the tree has uncommitted changes, say so. Recommend working on a branch
  (`docs/adopt-<project>`) before generating anything.

### 2. Reconnaissance (read-only)
Run the fact collector, then read what it points to:

```bash
node <skill-dir>/scripts/recon.mjs <project-root>
```

It prints a facts sheet: history, structure, manifests and scripts, CI, documentation present,
tests, TODO markers, tracked `.env` files. Then read, guided by it:

| Look at | To learn |
|---|---|
| README, existing docs, `CLAUDE.md` | The stated purpose and what the authors thought worth writing down |
| Entry points: manifest `main`/`scripts`, `Dockerfile` `CMD`, main files | How it starts and runs |
| Top-level folders and their contents | The module map and each module's role |
| Schema, migrations, models | The data model |
| Routes, controllers, queues, jobs, CLI commands | The main flows |
| Environment variable reads, config files | Configuration and secrets handling |
| Third-party clients and calls | External dependencies |
| Test layout and the way tests are run | What is actually verified |
| CI and deployment files | How it is built, released and deployed |
| Most changed files and the last activity per folder (`git log`) | What is alive and what is dead |

For a large repository (more than about 300 files), explore one area per `Explore` agent in
parallel and require each to return findings with file paths. Do not copy personal names or
e-mail addresses from the git history into committed documents.

### 3. Health baseline (this executes the project's code)
Ask before running install, build or test commands: they can take time, need network access or
have side effects. If allowed, run the project's **own** scripts and record, for each, the exact
command and the outcome (passes / fails / cannot run) with the first meaningful error line. Do
not repair anything. If there is no test or build command, record that.

### 4. Reconstruct (in memory, not yet on disk)
Write up, labelling Fact / Inference / Unknown:
- **Purpose** and who uses it
- **Structure**: the module map
- **Runtime and flows**: how it starts, the main paths through it
- **Data** and **external dependencies**
- **Conventions observed**, each with example paths and how consistently it is followed
- **Implicit decisions**: the decision, its evidence, "rationale: unknown"
- **Health baseline** and **risks or debt** (no tests, tracked secrets, dead code, hotspots, large
  files, TODO density, outdated tooling)
- **Contradictions** between existing documents and the code (the code wins)
- **Unknowns**

### 5. Confirm with the user
Ask only what the code cannot say, in rounds of at most 4 questions:
1. **Intent and status** — show the inferred purpose and ask whether it is right; is the project
   in production, dormant but valuable, experimental, or unknown?
2. **Constraints** — areas that are fragile, generated, vendored or off-limits; deployment
   targets; deadlines.
3. **Rules** — which observed conventions become rules (multi-select, drawn from step 4)?
4. **Working rules for the agent** — the questions of phase D in
   [../project-init/interview.md](../project-init/interview.md): working mode, always-ask
   triggers, autonomy, commit and attribution rules. In quick mode, apply the defaults of
   [../project-init/rules-catalog.md](../project-init/rules-catalog.md) and show them for
   correction.

### 6. Reflect back
Show what will be written, not a paraphrase: the purpose sentence; the module map; the **exact
text of the numbered hard rules** (from the catalogue); the decisions to record and how (ADR
when the user gave the rationale, log line "rationale unknown" otherwise); the risks and debt;
the open questions; the files to be created or merged. Wait for validation.

### 7. Generate
Follow the generation step of [../project-init/SKILL.md](../project-init/SKILL.md) (templates,
catalogue, hooks, merge-never-overwrite), with these specifics:

- **`CLAUDE.md`** — merged if one exists. Section 1 carries the confirmed purpose and the
  takeover goal.
- **`docs/architecture.md`** — richer than at init, from verified facts only: layout with each
  folder's role, runtime and flows, data model, external dependencies, how to run and test,
  conventions in place. Add a section only for something that exists; every path it cites must
  exist.
- **Decisions** — an ADR only where the user supplied the rationale, following the retroactive
  procedure of the `adr-new` skill. Otherwise add to `.assistant/decisions-log.md`:
  `YYYY-MM-DD — observed in code: <decision> — rationale unknown (evidence: <path>)`.
- **`.assistant/takeover-report.md`** from `templates/takeover-report.md` — a dated snapshot of
  the baseline, risks, unknowns and suggested first steps. It is **not maintained**: items are
  deleted as they are resolved or moved to issues.
- **Existing documents that contradict the code** — correct them, or record the doubt as an
  *Open question*.
- Generate only what the project lacks; merge, never overwrite.

### 8. Verify
Run `node scripts/check-docs.mjs`, then the judgement checks of the `project-sync` skill
(architecture against the tree in particular). Activate the git hooks if they were generated
(see the hooks step of `project-init`).

### 9. Hand over
- Do **not** commit unless asked; propose the branch name and a commit message.
- Summarise: what the project is, its baseline, the main risks, the open questions.
- Suggest first steps in order (for example: the baseline test run fails — fix that before any
  feature work).
- State: "From now on, follow the Living documentation protocol in `CLAUDE.md`."

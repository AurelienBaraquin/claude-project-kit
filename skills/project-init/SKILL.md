---
name: project-init
description: Bootstrap the working foundations of a new or small project through an interview — brief, CLAUDE.md, docs/architecture.md, ADR set-up, decisions and lessons logs, PR/issue templates, git hooks, docs check. Use when starting a project, when a repository has no CLAUDE.md or architecture.md, or when the user asks to set up project conventions or documentation. For a substantial existing codebase you are taking over, use project-adopt instead. Produces a minimal v0 and never invents decisions; the project then keeps its documentation alive with the adr-new and project-sync skills, and new agents get up to speed with project-onboard.
---

# project-init

Set up the foundations that let an AI agent understand a project and keep it coherent, **without
pretending to know what is not yet decided**. The output is a *minimal v0*. Everything that
cannot be known on day 1 (architecture, most decisions) is recorded later, as it happens, by
`adr-new` and `project-sync`.

## Principles

1. **Read before asking.** Scan the repository and any brief the user points to. Never ask what
   the files already answer.
2. **Never invent.** A decision the user has not made is not written as a decision. Unknowns go
   to the *Open questions* section of `CLAUDE.md`.
3. **Ask in small batches.** At most 4 questions per round, through `AskUserQuestion` when
   available, and always an "I don't know yet / decide later" path. Mark an option
   "(Recommended)" and put it first **only when there is a reason** — detected in the repository
   or a widely accepted practice — and state that reason in its description. With no basis, mark
   none rather than fake a preference. In multi-select questions, say in the question text what
   an unchecked box means: *unchecked = the agent asks first*, never "forbidden" by inference.
4. **Reflect back before writing.** Summarise what you understood and get a yes.
5. **Minimal v0.** Fewer, true files beat many speculative ones. A short `CLAUDE.md` (≤ 100
   lines) is a feature. Minimal means no speculative file; it never means leaving something that
   already exists undocumented (see step 5b).
6. **Idempotent and non-destructive.** If a target file exists, show what would change and ask;
   never overwrite silently.
7. **Teach the loop.** The generated `CLAUDE.md` must contain the *Living documentation
   protocol* so the agent knows it may and should call `adr-new`, `project-sync` and
   (for a fresh agent) `project-onboard`, and edit docs by itself from then on.

## Procedure

### 1. Detect the situation
- **What the user wrote when invoking the skill is the first input**: the purpose of the project,
  goals, constraints, deadlines. Extract it, show it back in the reflect-back step, and never ask
  again for what was already said.
- Greenfield (empty or near-empty repo) or existing project? Check `git ls-files`, manifests
  (`package.json`, `pyproject.toml`, `go.mod`, …), README, CI, existing `CLAUDE.md`/`docs/`.
- If the user gave no brief or assignment document, ask for its path or a short description as
  the first question. Read it fully.
- If the repository is a substantial existing codebase that the user did not write or is
  returning to after a long time, suggest `project-adopt` instead: it reconstructs what exists
  before setting rules.

### 2. Pre-fill from the repository (existing projects)
Derive stack, layout, scripts (test/lint/build), CI, conventions, and existing ADRs. These become
proposed answers, shown for confirmation, not questions.

Also detect what the process answers will depend on, and record mismatches as *Open questions*
rather than assuming: no git remote while the user wants issues and PRs (`git remote -v`), no
CI while a docs check workflow is requested, no test script while "tests for all logic" is a
rule, an existing `CLAUDE.md` or `.claude/settings.json` that must be merged, not replaced.

### 3. Choose the depth, then interview
Announce the mode in one line when you present the scan, and say the user can ask for the other.

- **Quick mode** — the default for a small project (one manifest, about 30 tracked files or
  fewer) or when the user is short on time. Settle everything the repository and the
  *Defaults* table of [rules-catalog.md](rules-catalog.md) can settle, then ask **one round of at
  most 4 questions**, chosen among the topics with no detectable basis: the purpose and scope
  (when neither the invocation prompt nor a brief states them), success and team, how work is
  tracked and reviewed, non-negotiables, commit attribution, cloud or team use. Everything else
  is shown, marked as a default with its reason, in the reflect-back step.
- **Thorough mode** — larger projects, or on request. Follow [interview.md](interview.md): phases
  A (context), B (technical), C (process), D (AI rules).

In both modes: skip every question already answered, and conduct the interview in the user's
language.

### 4. Reflect back
Show what will actually be written, not a paraphrase:
- the **brief**: purpose, users, scope in and out, priorities, success criteria, constraints;
- the **exact text of the numbered hard rules** (built from [rules-catalog.md](rules-catalog.md),
  defaults marked as such);
- the surface documents to be created (step 5b);
- the open questions;
- the list of files that will be created or merged.

Wait for validation or corrections. Apply corrections to the rules text itself, then show it
again if it changed materially.

### 5. Generate
Use the files in `templates/` (this skill's folder). Choose templates from the answers:

| Template | Generate when | Target |
|---|---|---|
| `CLAUDE.md.tmpl` | always | `CLAUDE.md` |
| `brief.md.tmpl` | always | `docs/brief.md` |
| `docs-index.md.tmpl` | always | `docs/README.md` |
| `architecture.md.tmpl` | always | `docs/architecture.md` |
| `adr-template.md` | always | `docs/adr/0000-template.md` |
| `decisions-log.md` | always | `.assistant/decisions-log.md` |
| `lessons.md` | always | `.assistant/lessons.md` |
| `pull_request_template.md` | project uses PRs | `.github/PULL_REQUEST_TEMPLATE.md` |
| `issue-user-story.md` | project uses GitHub issues | `.github/ISSUE_TEMPLATE/user-story.md` |
| `commit-msg` | user wants enforced commit rules | `.githooks/commit-msg` (make it executable) |
| `pre-commit` | `.githooks/` is generated (offer it on its own if the user declined commit rules) | `.githooks/pre-commit` (executable) — runs `scripts/check-docs.mjs` before every commit |
| `ensure-git-hooks.sh` | `.githooks/` is generated | `.claude/hooks/ensure-git-hooks.sh` (executable), wired in `.claude/settings.json` |
| `settings.json` | user wants no AI attribution, or `.githooks/` is generated | `.claude/settings.json` — merge, never overwrite; keep the `attribution` block only if the user wants no AI attribution, and the `hooks` block only if `.githooks/` is generated |
| `.claude/skills/` copies of `adr-new`, `project-sync`, `project-onboard` | the user will use the project in cloud sessions or with people who do not have the kit | run `<kit>/install.sh --project <project-root>`, where `<kit>` is two levels above the real path of this skill's folder (`realpath`); if `install.sh` is not there (skills installed with `--copy`), copy those three folders by hand, without `*.test.mjs` |
| `docs-check.yml` | project uses GitHub Actions | `.github/workflows/docs-check.yml` |
| `../project-sync/scripts/check-docs.mjs` | always | `scripts/check-docs.mjs` (or the layout's script folder) |

Rules when filling a template:
- Replace every `{{placeholder}}` with a real value, or delete the line/section. **No unresolved
  placeholder, no "TODO" left in the output.** Unknowns become *Open questions*.
- Delete template sections that do not apply; do not keep empty headings.
- Hard rules come from [rules-catalog.md](rules-catalog.md): copy each sentence verbatim,
  substituting only its `<values>`, so wording is identical across projects. Never turn the
  working mode into numeric limits (files, lines).
- Write in the language the user chose for the project docs (templates are in English).
- Do not create files the project's own rules forbid (for example files at the repository root
  when the user says so); adapt the target path.
- ADRs: write one **only** for a decision the user explicitly made and for which alternatives
  were discussed — use the `adr-new` procedure. Otherwise add one dated line to the decisions log.
- `docs/brief.md` is built from the invocation prompt, any brief or README, and the phase A
  answers. It states the owner's intent: do not add scope the user did not state; unknown
  sections are deleted and their questions go under its *Open questions*. If an external
  assignment exists, link and summarise it, do not copy it.
- Fill `docs/architecture.md` only with what *exists* (layout, conventions already in place).
  Describe nothing that is not built yet.

### 5b. Surface documents
Everything that exists and that someone needs to build, run, test, ship, operate or use the
project has one document. For each surface of [../project-sync/doc-surfaces.md](../project-sync/doc-surfaces.md)
whose *Signals* are present in the repository **now**, create its document from verified facts,
following that surface's *Must contain*, and add its row to `docs/README.md` (*Document*, *What it
answers*, *Covers*, *Update when*). **Fill *Covers* with real paths in code spans**, including the
top-level folders under `architecture.md`: the docs check reads them, and reports as an error any
top-level folder, `Dockerfile`, compose file, CI pipeline file, `.env.example`, API contract, schema or
migrations folder that no row covers. The template's own row covers the docs tooling (`scripts/`,
`docs-check.yml`) that init generates. Paths that truly need no document go in `coverageIgnore` in
`.docs-check.json`. Keep each short; what you cannot verify becomes `Unknown:` plus
an open question.

A project with nothing built yet gets none of these: each is created in the change that introduces
its surface, which is what the protocol in `CLAUDE.md` asks of the agent. Never write a document
for a surface that does not exist.

### 6. Verify
Run `node scripts/check-docs.mjs`. Fix what it reports. Show the user the list of created files.

### 6a. Skills for cloud sessions and teammates
Personal skills (`~/.claude/skills`) are not loaded in cloud sessions or on another person's
machine; a repository's own `.claude/skills/` is part of the clone and is. When the user chose
cloud or team use, copy the day-to-day skills there (table above) and remind them to **commit**
`.claude/skills/`. `project-init` and `project-adopt` stay personal: they run once, locally. The
copies can fall behind the kit; `project-sync` reports it.

### 6b. Activate the hooks
If `.githooks/` was generated, run `git config core.hooksPath .githooks` (the user asked for
enforced rules; it is a local, reversible setting) and say so. Remind the user that every fresh
clone needs the same command. The `ensure-git-hooks.sh` hook makes Claude Code refuse
`git commit` until it is done, so a clone cannot silently skip the checks.

### 7. Hand over
- Do **not** commit unless asked; propose a branch name and commit message following the
  project's own conventions.
- State clearly: "From now on, follow the Living documentation protocol in `CLAUDE.md`: record
  decisions with `adr-new`, document every surface you add or change in the same change (index in
  `docs/README.md`), run `project-sync` before PRs."
- List the open questions and who should answer them.

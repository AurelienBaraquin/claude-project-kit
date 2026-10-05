---
name: project-init
description: Bootstrap the working foundations of a project (new or existing) through an interview — CLAUDE.md, docs/architecture.md, ADR set-up, decisions and lessons logs, PR/issue templates, commit hook, docs check. Use when starting a project, when a repository has no CLAUDE.md or architecture.md, or when the user asks to set up project conventions or documentation. Produces a minimal v0 and never invents decisions; the project then keeps its documentation alive with the adr-new and project-sync skills.
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
   lines) is a feature.
6. **Idempotent and non-destructive.** If a target file exists, show what would change and ask;
   never overwrite silently.
7. **Teach the loop.** The generated `CLAUDE.md` must contain the *Living documentation
   protocol* so the agent knows it may and should call `adr-new` / `project-sync` and edit docs
   by itself from then on.

## Procedure

### 1. Detect the situation
- Greenfield (empty or near-empty repo) or existing project? Check `git ls-files`, manifests
  (`package.json`, `pyproject.toml`, `go.mod`, …), README, CI, existing `CLAUDE.md`/`docs/`.
- If the user gave no brief or assignment document, ask for its path or a short description as
  the first question. Read it fully.

### 2. Pre-fill from the repository (existing projects)
Derive stack, layout, scripts (test/lint/build), CI, conventions, and existing ADRs. These become
proposed answers, shown for confirmation, not questions.

Also detect what the process answers will depend on, and record mismatches as *Open questions*
rather than assuming: no git remote while the user wants issues and PRs (`git remote -v`), no
CI while a docs check workflow is requested, no test script while "tests for all logic" is a
rule, an existing `CLAUDE.md` or `.claude/settings.json` that must be merged, not replaced.

### 3. Interview
Follow [interview.md](interview.md): phases A (context), B (technical), C (process), D (AI
rules). Skip every question already answered. Conduct it in the user's language.

### 4. Reflect back
Show what will actually be written, not a paraphrase:
- the project description, in one or two sentences;
- the **exact text of the numbered hard rules** (built from [rules-catalog.md](rules-catalog.md),
  defaults marked as such);
- the open questions;
- the list of files that will be created or merged.

Wait for validation or corrections. Apply corrections to the rules text itself, then show it
again if it changed materially.

### 5. Generate
Use the files in `templates/` (this skill's folder). Choose templates from the answers:

| Template | Generate when | Target |
|---|---|---|
| `CLAUDE.md.tmpl` | always | `CLAUDE.md` |
| `architecture.md.tmpl` | always | `docs/architecture.md` |
| `adr-template.md` | always | `docs/adr/0000-template.md` |
| `decisions-log.md` | always | `.assistant/decisions-log.md` |
| `lessons.md` | always | `.assistant/lessons.md` |
| `pull_request_template.md` | project uses PRs | `.github/PULL_REQUEST_TEMPLATE.md` |
| `issue-user-story.md` | project uses GitHub issues | `.github/ISSUE_TEMPLATE/user-story.md` |
| `commit-msg` | user wants enforced commit rules | `.githooks/commit-msg` (+ tell the user to run `git config core.hooksPath .githooks`) |
| `settings.json` | user wants no AI attribution in commits/PRs | `.claude/settings.json` (merge, never overwrite) |
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
- Fill `docs/architecture.md` only with what *exists* (layout, conventions already in place).
  Describe nothing that is not built yet.

### 6. Verify
Run `node scripts/check-docs.mjs`. Fix what it reports. Show the user the list of created files.

### 7. Hand over
- Do **not** commit unless asked; propose a branch name and commit message following the
  project's own conventions.
- State clearly: "From now on, follow the Living documentation protocol in `CLAUDE.md`: record
  decisions with `adr-new`, keep `docs/architecture.md` true, run `project-sync` before PRs."
- List the open questions and who should answer them.

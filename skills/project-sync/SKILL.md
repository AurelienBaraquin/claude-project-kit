---
name: project-sync
description: Audit a project's documentation against its code and fix drift — broken links, cited paths that no longer exist, malformed ADRs, architecture.md out of step with the tree, decisions without an ADR, lessons without a safeguard. Use before opening a PR, at the end of a work session, after structural changes, when joining an existing project, or when the user asks whether the docs are up to date.
---

# project-sync

Documentation drifts silently; an agent that trusts a stale document propagates the error. This
skill finds the drift and repairs it.

## 1. Run the deterministic check

```bash
node scripts/check-docs.mjs
```

(If the project has no copy of the script, run the one in this skill's `scripts/` folder:
`node <skill-dir>/scripts/check-docs.mjs <project-root>`.)

It verifies: relative Markdown links resolve; paths cited in code spans in `CLAUDE.md` and
`docs/architecture.md` exist; ADRs are numbered without gaps, have a valid `Status`, and
supersede targets exist. Options go in `.docs-check.json` (`ignore`, `pathDocs`, `adrDir`,
`ignorePaths`).

**Is the project's copy current?** Compare `node scripts/check-docs.mjs --version` with
`node <skill-dir>/scripts/check-docs.mjs --version`. If the project's copy is older, or prints no
version, offer to replace it with the skill's copy. The script is meant to stay unmodified;
configuration lives in `.docs-check.json`.

Fix mechanical problems directly: update the renamed path, repair the link. If a cited path is
gone because the code was deleted, remove or rewrite the sentence — do not recreate the file.

## 2. Judgement checks (read, compare, then decide)

| Check | How | Fix |
|---|---|---|
| `docs/brief.md` matches reality | Compare its scope, priorities and success criteria with what is built and with recent decisions in the log; look for features outside the stated scope, in-scope items abandoned, criteria no longer measured | Propose the update to the user; change the brief only once they agree, then record it with `adr-new` |
| `docs/architecture.md` matches the tree | List top-level folders and the modules/routes/tables/events the doc names; look for new ones it omits and described ones that are gone | Update the doc to what exists — only what exists |
| Decisions without a record | Skim recent `git log` and the decisions log for structural choices (new dependency, pattern, boundary) | Run `adr-new` for any that lack an ADR or log line |
| `CLAUDE.md` holds volatile detail | Look for counters, issue ranges, sprint-specific numbers, copied architecture | Move them to the document that owns them, or delete; keep the file short |
| Rules versus reality | Pick the commands, thresholds and rules in `CLAUDE.md`; verify them against `package.json`/config/CI | Correct the file |
| Lessons without a safeguard | Entries in `.assistant/lessons.md` whose "what now prevents it" is empty | Propose a test, lint rule, hook or CI check |
| Open questions | Entries in `CLAUDE.md` that the code or the user has since answered | Resolve and remove, recording the answer where it belongs |
| Enforcement is active | If `.githooks/` exists, `git config core.hooksPath` must print `.githooks`; `.claude/hooks/ensure-git-hooks.sh` must exist and be wired in `.claude/settings.json` | Activate the hook path, restore the missing files |
| Superseded ADRs | ADRs still marked Accepted whose subject was replaced | Mark them superseded via `adr-new` |

## 3. Report

Give a short report: what the script found, what you fixed, what you changed after judgement
checks, and what needs a human decision. Never claim "all consistent" without having run the
script and the judgement checks.

## 4. Boundaries

- Mechanical fixes and factual corrections: do them, in the current change.
- Anything that changes a *decision*, a *rule* or the *brief*: propose it, and write it through `adr-new` or
  after the user agrees.
- Do not invent documentation for things that do not exist.

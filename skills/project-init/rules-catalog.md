# Rules catalogue

Canonical sentences for the *Hard rules* section of `CLAUDE.md`. Every interview answer maps to
one sentence here, so two runs on two projects produce the same wording.

How to use it:

- Copy the sentence **verbatim**, substituting only `<values>`. Do not paraphrase.
- Number the rules in the order of the topics below. Skip topics the user did not choose.
- A rule the user wants that is not listed: write it in the same imperative style, and tell the
  user it could be added to this catalogue.
- Never write a rule for an answered "decide later": it goes to *Open questions*.

## Quality

| Answer | Rule |
|---|---|
| Tests for all logic | Every piece of new logic ships with a test. `<test command>` must pass before a change is done. |
| Coverage threshold `<N>` % | Test coverage must stay at or above `<N>` %. |
| Lint + format enforced | Lint and formatting must pass (`<command>`) before a change is done. |
| Strict typing | Type checking runs in strict mode (`<command>`); do not use `any` or equivalent escape hatches. |

## Non-negotiables

| Answer | Rule |
|---|---|
| Security | Never commit secrets, credentials or `.env` files; secrets come from the environment. Validate all external input at the boundary. |
| Privacy / GDPR | Collect the minimum personal data, and keep the export and deletion paths working. |
| Accessibility | User-interface changes must meet WCAG 2.1 AA and keep the automated accessibility checks green. |
| Performance | State a measurable budget before optimising, and verify it after. |

## Process

| Answer | Rule |
|---|---|
| Issues + branches + PRs | Never commit or push to `main`. Work on a branch and open a pull request that links its issue (`Closes #N`). |
| Direct commits on `main` | Commit directly to `main`, in small commits that each leave the tests green. |
| Solo review | The owner merges pull requests; you do not. |
| Team review | A pull request needs `<N>` approval(s) from someone other than its author before it is merged. |
| Conventional Commits | Commits follow Conventional Commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `perf`, `build`). |
| No AI attribution | Never add `Co-Authored-By` or "Generated with" lines to commits or pull requests; enforced by `.githooks/commit-msg` and `.claude/settings.json`. |
| Docs check (when `.githooks/pre-commit` is generated) | The documentation check (`node scripts/check-docs.mjs`) runs before every commit and in CI; fix what it reports instead of bypassing it. |
| Hook activation (when `.githooks/` is generated) | Enable the git hooks once per clone with `git config core.hooksPath .githooks`; Claude Code refuses `git commit` until they are active. |

## Working mode (exactly one)

| Answer | Rule |
|---|---|
| Plan, one approval | Working mode: propose a plan, wait for one approval, then execute and report at the end. The owner can override it for a given task. |
| Step by step | Working mode: propose a plan, then stop for validation after each step. The owner can override it for a given task. |
| In one go | Working mode: execute in one go and report at the end. The owner can override it for a given task. |
| By risk | Working mode: act freely on reversible changes; stop on structural or irreversible ones. The owner can override it for a given task. |

## Always ask before (one rule listing the chosen triggers)

Triggers: *adding a dependency*, *deleting files or data*, *schema migrations*, *changing CI or
hooks*, *pushing, deploying or publishing*, *changing a public API*.

Rule: `Always ask before: <chosen triggers, comma-separated>.`

## Autonomy (one rule listing the allowed actions)

Actions: *edit documentation*, *write ADRs and decision-log entries*, *create branches*, *open
pull requests*, *merge pull requests*.

Rule: `Autonomy: without asking you may <allowed actions>. Anything else that changes the
repository or the outside world: ask first.`

## Language

| Answer | Rule |
|---|---|
| One language `<L>` | Code, commits and documentation are written in `<L>`. |
| Split | Documentation is written in `<L1>`; code and commits in `<L2>`. |

## Always present (every project)

- Do what the task asks, nothing more.
- Read a file fully before editing it.
- Never state something about the code you have not verified in the code.

## Defaults (used by the quick mode, always shown to the user for correction)

| Topic | Default | Reason |
|---|---|---|
| Working mode | By risk | Reversible changes are cheap to undo; mistakes cost on the others |
| Always ask before | adding a dependency, deleting files or data, schema migrations, changing CI or hooks, pushing, deploying or publishing | Each is hard to reverse or visible outside the repository |
| Autonomy | edit documentation, write ADRs and decision-log entries | The living-documentation protocol depends on it |
| Commit format | Conventional Commits, if the git history or CI already uses it | Matches what the project already does |
| Tests | Tests for all logic, if the repository already has a test command | Matches what the project already does |
| Language | The language of the existing README and commits | Matches what the project already does |

A topic with no detectable basis has no default: ask it, or record an *Open question*.

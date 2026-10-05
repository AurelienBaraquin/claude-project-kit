# Interview guide

Question bank for `project-init`. Ask only what the repository and the brief do not already
answer. At most 4 questions per round, always allow "decide later" (it becomes an *Open
question*, not a guess). Ask in the user's language.

## Offering options

- Mark one option "(Recommended)", first in the list, **only if you can give a reason** (it is
  what the repository already does, or a widely accepted practice) and write that reason in the
  option's description. If there is no basis, mark none.
- Multi-select: state in the question what an unchecked item means. Default: **unchecked = the
  agent asks first**. Do not infer "forbidden" from a missing check.

## Quick mode and thorough mode

- **Quick** (small project, or little time): propose defaults for every topic that has a basis
  (the repository, or the *Defaults* table of `rules-catalog.md`), then ask one round of at most
  4 questions among the topics with **no** basis — typically the purpose and scope when neither
  the invocation prompt nor a brief states them, success and team, tracking and review,
  non-negotiables, commit attribution. The user amends the proposed defaults in the
  reflect-back step.
- **Thorough** (larger project, or on request): go through phases A to D below.

Whatever the mode, a topic with no basis and no answer becomes an *Open question*.

## Phase A — Context

| Question | Why it matters | Skip if |
|---|---|---|
| What is the project, in one or two sentences? Who uses it, and what must they be able to do? | `Purpose` and `Users` of `docs/brief.md`, first paragraph of `CLAUDE.md` | the invocation prompt, the brief or the README states it |
| Is there a brief, assignment or spec? Where? | Linked and summarised in `docs/brief.md` | already given |
| What is in scope for the first version, and what is explicitly out? | `Scope` of `docs/brief.md` | the brief states it |
| What matters most when time is short (priorities, MoSCoW)? | `Priorities` of `docs/brief.md` | the brief states it |
| How is success judged (grade, users, deadline, demo)? | `Success criteria` of `docs/brief.md` | the brief states it |
| Constraints: deadline, platform, mandated technology, legal limits? | `Constraints` of `docs/brief.md` | none apply |
| Team size, roles, timeline? | Review policy, PR sizing | solo and no deadline |

## Phase B — Technical

| Question | Why | Skip if |
|---|---|---|
| Stack and runtime versions? | Commands, strictness rules | manifests answer it |
| Where does it run (local, VPS, cloud, containers)? | Deployment notes, what "done" means | nothing to deploy |
| Data stores, external services? | Boundaries to document | detectable |
| Non-negotiables: security, privacy/GDPR, accessibility, performance, i18n? | Hard rules and early oracles | none apply |
| Quality bars: strict typing, coverage threshold, lint/format? | Hard rules the agent must respect | config files answer it |
| Existing code to keep, ignore or never touch? | Protects frozen or legacy areas | greenfield |

## Phase C — Process

| Question | Why | Skip if |
|---|---|---|
| Branching and commit conventions (Conventional Commits, branch naming)? | Hard rules, commit hook | CONTRIBUTING states it |
| Review policy (approvals, who merges, squash)? | Agent must not self-merge | solo |
| Where is work tracked (GitHub issues/board, other)? Must every change link to an item? | Issue template, PR template | no tracker |
| CI: what runs, what blocks a merge? Do docs-only changes skip it? | Docs check job | no CI yet |
| Definition of done? | PR checklist | none defined |
| Release and versioning approach? | Optional section | no releases |

## Phase D — Rules for the AI agent

| Question | Why | Skip if |
|---|---|---|
| Autonomy: which of these may the agent do without asking — edit docs, write ADRs, create branches, open PRs, merge? (multi-select; unchecked = asks first) | Defines the protocol's boundaries | — (always ask) |
| Working mode: how does the agent proceed? (a) plan, one approval, then execute and report; (b) plan, then stop for validation after each step; (c) execute in one go and report at the end; (d) by risk — free on reversible changes, stops on structural or irreversible ones | Replaces any numeric limit; sets the rhythm of validation | — (always ask) |
| Always ask before… (multi-select): adding a dependency, deleting files or data, schema migration, changing CI or hooks, pushing / deploying / publishing, changing a public API | Risk triggers that hold in every mode | — (always ask) |
| Identity and attribution: commit author, may it add `Co-Authored-By`/"Generated with" lines? | Enforce via `settings.json` and the commit hook, not prose | — |
| Forbidden actions (push to main, touch folders, add dependencies, run migrations)? | Hard rules | — |
| Language of code, commits, documentation? | Language of generated docs | consistent in repo |

## Closing

- "Anything I should know that I did not ask?" (one open question).
- Read back the **open questions** list and confirm who owns each.

## Anti-patterns

- Asking 20 questions in a row: batch, prefill, skip.
- Turning a vague preference into a rule or an ADR: if the user hesitated, it is an open question.
- Fixed numeric limits ("stop after 3 files / 50 lines"): size is not risk. Ask for a working mode
  and risk triggers instead.
- Interrogating about architecture on day 1 for a project that has none yet: record the
  constraints, leave the design to be decided with `adr-new` when the need arises.

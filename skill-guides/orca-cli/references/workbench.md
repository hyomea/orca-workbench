# Workbench commands

Workbench (the Workbench page in Orca) stores initiatives, outcomes, features, roles, tasks,
test plans, and initiative notes on this computer. These commands change the same records,
with the same validation, as the Workbench page. An initiative is a business goal that spans
repositories; it is not an Orca project (repository). Stored records and flags still call it
a project: `projectId`, `project.create`, and `--project` all refer to an initiative.

## Outcomes and features

Work starts from an outcome: what this piece of work should achieve, such as "allow multiple
check-ins on mobile", a bug fix, or engineering work like a test foundation. Outcomes are
stored as work items (`workItem.*` commands, `workItemId` on tasks). Each outcome has:

- `kind`: `initial` (new capability), `bug`, `improvement`, `investigation`, or
  `engineering`.
- `tickets`: one per platform involved, `{ "platform": "ios" | "android" | "backend",
  "reference": "<key or link>" }`. The reference may be empty until the ticket exists.
- `parity`: true when iOS and Android must behave the same. A parity outcome needs a shared
  test plan with reviewed evidence on both platforms before it is accepted; others do not.
- `featureId` (optional): the product feature it changes. A feature is the lasting record of
  a capability and its specification; an accepted new capability or improvement publishes
  its specification there. Many outcomes, such as engineering work, have no feature.

A feature also holds its row in the parity inventory, set with `feature.parity`: for `ios` and
`android`, a `status` (`same`, `differs`, `missing`, `platform-specific`, or `unknown`), a
`note` that explains any status other than `same` (including why it is unknown), the
`evidence`, and `checkedOn` (YYYY-MM-DD); plus `ruleLocation` (where the business rule lives,
preferably the API) and `needsHardware`. Record only what you checked, with its evidence; the
user can correct it. Parity is recorded when an outcome touches a feature: check how the
feature behaves on both platforms before changing it, and record it. Do not propose surveying
features no outcome touches unless the user asks for it.

Change tickets, parity, or the feature link of an outcome in progress with `workItem.scope`;
its `feature` is omitted to keep the link, `null` to remove it, or a feature id.

```text
ORCA workbench status [--project <id>] --json
ORCA workbench schema --json
ORCA workbench apply --body-file <file|-> [--revision <n>] --json
ORCA workbench task start <task-id> --worktree <selector> --json
ORCA workbench task submit [<task-id>] --body-file <evidence.md> --json
ORCA workbench note propose --project <id> --title <title> --body-file <file> [--note <id>] [--task <id>] [--reason <why>] --json
ORCA workbench personal-notes list [--repo <name>] --json
ORCA workbench personal-notes index
```

## Read before writing

Run `status --json` first. It returns the stored records with ids and the current
`revision`. Run `schema` to see every command `apply` accepts; do not guess field names.

## Apply a batch

`apply` takes `{"steps":[...]}`. Each step is `{"ref"?: "<name>", "command": {...}}`. A
later step uses `"$ref:<name>"` wherever it needs the id created by that step. Every step
applies, or none does. Pass `--revision` from `status` when you planned against a specific
state; a concurrent change then rejects the batch instead of mixing with it.

```json
{
  "steps": [
    {
      "ref": "item",
      "command": {
        "kind": "workItem.create",
        "workItem": {
          "projectId": "<project-id>",
          "featureId": "<feature-id, only when it changes a feature>",
          "kind": "improvement",
          "title": "Allow multiple check-ins on mobile",
          "description": "...",
          "acceptanceCriteria": "...",
          "designReferences": "",
          "tickets": [
            { "platform": "ios", "reference": "ENG-123" },
            { "platform": "android", "reference": "ENG-124" },
            { "platform": "backend", "reference": "ENG-125" }
          ],
          "parity": true
        }
      }
    },
    {
      "command": {
        "kind": "task.create",
        "task": {
          "projectId": "<project-id>",
          "roleId": "<role-id>",
          "workItemId": "$ref:item",
          "title": "...",
          "instructions": "...",
          "acceptanceCriteria": "...",
          "platform": "android"
        }
      }
    }
  ]
}
```

Reuse an existing role or feature from `status` instead of creating a duplicate; create a
feature only for a product capability, with `feature.create`. A task
needs a role; create one with `role.create` in the same batch when none fits.
Change a role with `role.update`, passing its current fields as `expected`; the optional
`agentName` gives the role's agent a personal name. A change reaches tasks started afterwards,
not agents already running.

## Planning from a ticket

When asked to plan a ticket, start from the outcome it should achieve: which platforms it
involves and their tickets, whether iOS and Android must behave the same, and whether it
changes a product feature. Read the tickets and the relevant code first, ask the user only
questions that change the plan, then show the plan in the conversation before applying it.
Put dependencies between tasks in the dependent task's instructions; Workbench does not
store task dependencies yet.

### Breaking work into tasks

Each task is one result the user reviews and accepts on its own, so split by purpose, not by
the number of files:

- One purpose per task. A task that cannot be described in one sentence is two tasks.
- Mechanical changes (renames, moves, formatting, generated code) are their own task, even
  when they touch many files, and never share a task with a behavior change.
- When an outcome crosses architecture layers, split along them: data (API, models,
  persistence), business logic, and UI. Each layer task is verified its own way: the data
  layer against the API contract, the logic with unit tests, the UI with screenshots or
  previews. Order them so later tasks build on accepted ones, usually data, logic, then UI.
- Tag each task with its platform: `ios`, `android`, `backend` (API work in a backend
  repository), or `shared` (discovery, QA, and other work for no single platform).
- When app work needs an API change, agree the API contract first (requests, responses,
  errors) and record it in the work item. App and backend tasks then run in parallel against
  that contract, the apps using stubs where the API is not ready. A final task verifies the
  apps against the real API on staging; the work item is accepted only after it passes. The
  backend side may be another team's ticket, linked from the work item.
- Do not split further than that. Keep a change in one task when the parts cannot be
  verified apart or one part is too small to review alone; a small feature can be one task
  across layers. Each task should still be a substantial piece of work an agent finishes on
  its own.

## Starting work

`task start` needs a workspace from a repository linked to the task's initiative. Find or
create one with `ORCA worktree list --json` or `ORCA worktree create`. `--worktree` takes any
worktree selector, such as `path:<absolute path>` or `branch:<branch>`. Starting a task
launches an agent with the task's saved prompt.

## Working on a task

Before changing code, read the code the task touches. If the task turns out to mix purposes,
such as a behavior change that first needs a broad rename or refactor, stop and tell the user
how you would split it, using the rules in "Breaking work into tasks". Do not change the
Workbench plan yourself; the user decides.

## Submitting a task

A task's agent submits its result when the user asks it to ("submit", "submit for review",
"hand it in"). Submitting moves the task to review, where the user reads the evidence, looks
at the code if they choose, and accepts it or sends it back. Do not submit on your own
initiative, and never accept a task.

1. If the work is not finished, do not submit. Tell the user what remains.
2. Commit the work on the task branch, following the repository's commit conventions, so
   the user reviews a fixed version. Do not push; the user decides when to push. When the
   user sent the task back, add a new commit for the changes rather than amending, so the next
   review can see what changed.
3. Write the evidence as Markdown to a file outside the repository, such as
   `$TMPDIR/orca-task-evidence.md`, with these sections:
   - **Changes**: what changed, by file or module.
   - **Verification**: each command you ran and its result, including test counts and
     failures. Say plainly when a check was not run.
   - **Acceptance criteria**: each criterion from the task, marked met, partly met, or not
     met, with the evidence.
   - **Departures from the task**: anything done differently from the instructions, and why.
   - **Not verified or needs a decision**: what you could not check, and questions for the
     user.
4. From inside the task's workspace, run
   `ORCA workbench task submit --body-file <file> --json`. Without a task id it submits the
   running task in the workspace that contains the current directory; pass the id (the
   prompt names it as "Workbench task <id>") when you run it elsewhere or the command asks.
   It refuses while the workspace has uncommitted changes, and records the submitted commit.
5. Tell the user it was submitted, with the commit. If the command fails, report its error; do not retry with
   another task id.

Only a running task can be submitted. Evidence is limited to 20,000 characters.

## Review boundary

Accepting a task, approving a test result, and publishing a feature specification record
the user's judgment. Run those commands only when the user asks for that specific decision
in the current conversation; never to approve work you or another agent produced on your
own initiative.

## Notes

`note propose` submits a note for the user to review in Workbench; it never changes a note
directly.

## Personal notes

The user's personal notes are Markdown files in a folder they chose; `personal-notes list`
prints each note's title, path, category, and front matter (`summary`, `applies`, `agents`).
They are reference material and may be out of date. A task's instructions already list the
notes meant for it; do not edit personal notes unless the user asks.

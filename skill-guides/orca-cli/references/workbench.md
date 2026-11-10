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

- `kind`: `initial` (new capability), `bug`, `improvement`, `investigation` (a discovery,
  shown as "Discovery"), or `engineering`. A discovery is worked out between the user and the
  steward, without code; see "Discovery".
- `tickets`: one per platform involved, `{ "platform": "ios" | "android" | "backend",
  "reference": "<key or link>" }`. The reference may be empty until the ticket exists. In a
  team initiative a ticket also records the user's part on that platform, `role`: `author`
  (the default: the user builds it), `reviewer` (a teammate builds it and the user reviews and
  tests their PR), or `tracking` (someone else's work, followed only); with `reviewer` or
  `tracking`, `pr` holds the teammate's PR link.
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

Each workbench (listed under Workbench in Orca's sidebar, such as the user's organization)
keeps its own initiatives, roles, and coordinator. Commands use the workbench whose coordinator
runs in the current directory, or the only one; elsewhere pass `--workbench <id>` from
`workbench list`. Task commands find the workbench that holds the task.

```text
ORCA workbench list --json
ORCA workbench status [--project <id>] --json
ORCA workbench schema --json
ORCA workbench apply --body-file <file|-> [--revision <n>] --json
ORCA workbench task start <task-id> --worktree <selector> --json
ORCA workbench task submit [<task-id>] --body-file <evidence.md> --json
ORCA workbench task step <step-id> [--task <task-id>] [--undo] --json
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
          "platform": "android",
          "stage": "development"
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
not agents already running. The steward (the user's coordinator) gets its personal name with
`steward.rename` (`null` clears it); it takes effect the next time the steward opens.

## Planning from a ticket

When asked to plan a ticket, start from the outcome it should achieve: which platforms it
involves and their tickets, whether iOS and Android must behave the same, and whether it
changes a product feature. Read the tickets and the relevant code first, ask the user only
questions that change the plan, then show the plan in the conversation before applying it.

In a team initiative, set each platform ticket's `role` from Jira: compare the ticket's
assignee with the user's own Atlassian account (`atlassianUserInfo`). Assigned to the user
means `author`. Assigned to someone else, ask whether the user reviews it (`reviewer`, with the
teammate's PR link once it exists) or only follows it (`tracking`). When Jira cannot be read,
ask the user. Show the roles in the plan; the user can change them in the outcome's tickets.

### Discovery

Some work starts as a question, not a ticket. The user and the steward work it out on an
`investigation` outcome, without code and without task agents:

- Read code, tickets, notes, and logs only; change nothing.
- Record what you learn with `workItem.findings` (Markdown, replacing the previous text): the
  problem, the evidence with facts apart from guesses, the options, and open questions.
- End it with `workItem.conclude`, when the user decides:
  - `{ "outcome": "work", "workKind": "bug" | "improvement" | "initial" | "engineering" }`:
    the same outcome continues as planned work. Write its description, acceptance criteria,
    and tickets first (`workItem.update`, `workItem.scope`), then plan its tracks.
  - `{ "outcome": "ticket", "reference": "<key or link>" }`: a ticket for later. Draft the
    ticket text; create it in Jira only when the user confirms.
  - `{ "outcome": "note", "noteId": "<id>" }`: an initiative note for later, created first
    with `note.create`.

### Tracks and stages

An outcome on one platform is a track. Each track has one task per stage, set with the task's
`stage`, and the stages run in order:

1. `development`: one agent session builds the whole track in one workspace and branch. Its
   work is planned as steps inside the task, not as separate tasks.
2. `codeReview`: a reviewer role reviews the submitted branch in a new session, without
   editing code. It starts only after development submits with a commit (`task submit`
   records it), and reviews that commit.
3. `qa`: a QA role tests the reviewed work: the tests, the outcome's acceptance criteria, and
   for a parity outcome the shared test plan on both platforms. It starts only after the user
   accepts the code review.

When the user sends findings back to development, the code review or QA session stays open.
After development submits again, the user asks that same session to look again
(`task.runAgain`): it checks the new commit against the findings it sent back, then submits an
updated report. A session waiting for that does nothing until the user asks; ending it instead
starts a fresh session on the next start.

Create the three tasks for each platform the outcome involves, with the same `workItemId` and
`platform` (`ios`, `android`, or `backend`; `shared` for work for no single platform). A
backend ticket owned by another team needs no tasks; the outcome links its ticket. Code
review and QA tasks always belong to an outcome.

The ticket's `role` decides which tasks a platform gets:

- `author`: all three stages, as above.
- `reviewer`: no development task, since the teammate builds it. `codeReview` reviews the
  teammate's PR in a workspace started on that PR (the user starts it from Orca's GitHub pull
  requests, or ask them to); it needs the ticket's `pr`. Its findings are drafted PR comments
  the user posts; nothing is sent back. When the author pushes again, the user asks for
  another round from the task's page. `qa` then tests the PR for integration: end-to-end flows
  against the real services, how it works with neighbouring features and the other platforms,
  and regressions. The track is done when the PR merges.
- `tracking`: no tasks; the row shows the ticket and PR. When the user sends findings back, they go
  to the track's development task, and code review and QA run again on the next submission.

An initiative reviews in one of two modes, set by the user with `project.reviewMode`:

- `personal` (the default): code review and QA are the agents' own, and a track is done when
  the user accepts development.
- `team`: the team also reviews the branch's pull request, and external QA records feedback
  at the outcome's `qaFeedbackUrl` (such as a Notion page). The code review agent triages the
  PR's comments and the QA agent that feedback: read only, a verdict per item (must fix, not
  needed with the reason, or needs discussion), and drafted replies for the user to post. The
  user asks for each new round from the task's page (`task.requestTriage`), decides what goes
  back to development, and the track is done when its PR merges. The user pushes and opens
  the PR; agents never push, open, comment on, or resolve anything there. On a track the user
  builds (`author`), the PR opens only after the local code review has submitted, so the team
  reviews a branch the reviewer agent has already checked.

### Planning development steps

Steps are the development checklist, set with `task.steps` (`[{ "id": "S1", "title": "..." }]`).
Replanning keeps the progress of steps whose id and title stay the same. Split by purpose,
not by the number of files:

- One purpose per step. A step that cannot be described in one sentence is two steps.
- Mechanical changes (renames, moves, formatting, generated code) are their own step, even
  when they touch many files, and never share a step with a behavior change.
- When the track crosses architecture layers, follow them: data (API, models, persistence),
  business logic, then UI. Verify each its own way: the data layer against the API contract,
  the logic with unit tests, the UI with screenshots or previews.
- When app work needs an API change, agree the API contract first (requests, responses,
  errors) and record it in the outcome. App and backend tracks then run in parallel against
  that contract, the apps using stubs where the API is not ready; QA verifies the apps against
  the real API on staging.
- Do not split further than that: a step is a commit worth reviewing, and a small change can
  be one step.

## Starting work

`task start` needs a workspace from a repository linked to the task's initiative. Find or
create one with `ORCA worktree list --json` or `ORCA worktree create`. `--worktree` takes any
worktree selector, such as `path:<absolute path>` or `branch:<branch>`. Starting a task
launches an agent with the task's saved prompt.

## Working on a task

Before changing code, read the code the task touches.

In a development task, work through its steps in order. If it has none, propose steps to the
user following "Planning development steps", and set them with `task.steps` once the user
agrees. Finish each step with a commit on the task branch (do not push), then mark it done
with `ORCA workbench task step <step-id>`, which records that commit and refuses while
changes are uncommitted. If a step turns out to mix purposes, such as a behavior change that
first needs a broad rename, tell the user how you would split it before going on. When the
prompt or the user gives findings from code review or QA, address them first, in new commits.

In a team initiative, a code review or QA task also triages the team's feedback as its
launch prompt describes, and a new round arrives as "Triage this new feedback first"; submit
the updated report with `task submit`.

In a code review or QA task, do not edit product code. Review or test the branch at the commit
development submitted, and report findings with stable IDs (B-1 for blocking, N-1 for
non-blocking) so the user can send them back. On a teammate's PR the user reviews, there is no
development task: review the PR as checked out in the workspace, and write each finding as a
comment the user can post (file and line, what and why, whether it blocks approval).

## Submitting a task

A task's agent submits its result when the user asks it to ("submit", "submit for review",
"hand it in"). Submitting moves the task to review, where the user reads the evidence, looks
at the code if they choose, and accepts it or sends it back. Do not submit on your own
initiative, and never accept a task.

1. If the work is not finished, do not submit. Tell the user what remains.
2. Commit the work on the task branch, following the repository's commit conventions, so
   the user reviews a fixed version. (Code review and QA usually have nothing to commit.) Do not push; the user decides when to push. When the
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

   A code review submits instead: **Verdict** (pass, pass with notes, needs fixes, or
   blocked), **Findings** grouped as Blocking, Non-blocking, Missing evidence, and Residual
   risk, each with its ID, file and line, and the fix it needs; and **Scope**: what was reviewed,
   against which commit. A QA task submits **Verdict**, **Results** (each test or scenario,
   platform, build, environment, pass/fail/blocked, and its evidence), and **Findings**. For a
   parity outcome, record each scenario result with `verification.record` as well.

4. From inside the task's workspace, run
   `ORCA workbench task submit --body-file <file> --json`. Without a task id it submits the
   running task in the workspace that contains the current directory; pass the id (the
   prompt names it as "Workbench task <id>") when you run it elsewhere or the command asks.
   It refuses while the workspace has uncommitted changes, and records the submitted commit.
5. Tell the user it was submitted, with the commit. If the command fails, report its error; do not retry with
   another task id.

Only a running task can be submitted. Evidence is limited to 20,000 characters.

## Outcome phase and sign-off

An outcome's phase comes from its tasks: the platform furthest behind decides whether it is in
development, code review, QA, waiting to merge, parity tests, or ready for sign-off. Do not
track progress on the outcome itself. Its only stored status is the user's sign-off:
`workItem.transition` with `status` `accepted` signs it off, and `planned` reopens it. Signing
off needs every linked task accepted, every execution closed, and for a parity outcome the
reviewed evidence on both platforms.

## Review boundary

Accepting a task, approving a test result, signing off an outcome, and publishing a feature
specification record the user's judgment. Run those commands only when the user asks for that specific decision
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

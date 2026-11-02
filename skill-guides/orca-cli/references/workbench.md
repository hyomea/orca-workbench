# Workbench commands

Workbench (the Projects page) stores business projects, features, work items, roles, tasks,
test plans, and project notes on this computer. These commands change the same records,
with the same validation, as the Projects page.

```text
ORCA workbench status [--project <id>] --json
ORCA workbench schema --json
ORCA workbench apply --body-file <file|-> [--revision <n>] --json
ORCA workbench task start <task-id> --worktree <worktree-id> --json
ORCA workbench note propose --project <id> --title <title> --body-file <file> [--note <id>] [--task <id>] [--reason <why>] --json
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
      "ref": "feature",
      "command": {
        "kind": "feature.create",
        "feature": { "projectId": "<project-id>", "name": "Checkout", "description": "" }
      }
    },
    {
      "ref": "item",
      "command": {
        "kind": "workItem.create",
        "workItem": {
          "featureId": "$ref:feature",
          "kind": "improvement",
          "title": "...",
          "description": "...",
          "acceptanceCriteria": "...",
          "designReferences": "",
          "sourceReference": "https://<site>.atlassian.net/browse/ENG-123"
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

Reuse an existing role or feature from `status` instead of creating a duplicate. A task
needs a role; create one with `role.create` in the same batch when none fits.

## Planning from a ticket

When asked to plan a ticket, read the ticket and the relevant code first, ask the user only
questions that change the plan, then show the plan in the conversation before applying it.
Put dependencies between tasks in the dependent task's instructions; Workbench does not
store task dependencies yet.

## Starting work

`task start` needs a workspace from a repository linked to the task's project. Find or
create one with `ORCA worktree list --json` or `ORCA worktree create`. Starting a task
launches an agent with the task's saved prompt.

## Review boundary

Accepting a task, approving a test result, and publishing a feature specification record
the user's judgment. Run those commands only when the user asks for that specific decision
in the current conversation; never to approve work you or another agent produced on your
own initiative.

## Notes

`note propose` submits a note for the user to review in Projects; it never changes a note
directly.

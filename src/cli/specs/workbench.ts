import type { CommandSpec } from '../args'
import { LOCAL_COMMAND_FLAGS } from '../args'

const WORKBENCH_NOTE =
  '--workbench takes a workbench id from `workbench list`. Without it, the workbench whose coordinator runs in the current directory, or the only one.'

export const WORKBENCH_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['workbench', 'list'],
    summary: 'List the workbenches on this computer with their ids',
    usage: 'orca workbench list [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS],
    notes: ['Each workbench keeps its own initiatives, roles, and coordinator.']
  },
  {
    path: ['workbench', 'status'],
    summary: 'Show Workbench initiatives, features, work items, tasks, and pending proposals',
    usage: 'orca workbench status [--project <id>] [--workbench <id>] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'project', 'workbench'],
    examples: ['orca workbench status', 'orca workbench status --project p1 --json'],
    notes: [
      '--json returns the stored records, including ids and the revision for `apply`.',
      '--project takes an initiative id; the flag and the stored `projectId` fields keep their earlier name.',
      WORKBENCH_NOTE
    ]
  },
  {
    path: ['workbench', 'schema'],
    summary: 'Print the JSON Schema of Workbench commands accepted by `apply`',
    usage: 'orca workbench schema [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS]
  },
  {
    path: ['workbench', 'apply'],
    summary: 'Apply Workbench commands atomically, the same way the Workbench page does',
    usage: 'orca workbench apply (--body <json> | --body-file <path|->) [--revision <n>] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'body', 'body-file', 'revision', 'workbench'],
    examples: ['orca workbench apply --body-file plan.json --json'],
    notes: [
      'The file holds {"steps":[{"ref":"feature","command":{...}}, ...]}. A later step uses "$ref:feature" for the id created by that step.',
      'Either every step applies or none does. Pass --revision from `status --json` to reject the batch if the data changed meanwhile.',
      WORKBENCH_NOTE
    ]
  },
  {
    path: ['workbench', 'task', 'start'],
    summary: 'Start a planned Workbench task in an existing workspace',
    usage: 'orca workbench task start <task> --worktree <selector> [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'task', 'worktree', 'workbench'],
    positionalArgs: ['task'],
    examples: [
      'orca workbench task start <task-id> --worktree path:/path/to/workspace --json',
      'orca workbench task start <task-id> --worktree branch:feature/ENG-123-fix --json'
    ],
    notes: [
      '--worktree accepts the same selectors as other worktree commands (path:, branch:, id:, active).',
      'The workspace must belong to a repository linked to the task’s initiative.'
    ]
  },
  {
    path: ['workbench', 'task', 'submit'],
    summary: 'Submit a running task’s result for the user to review',
    usage: 'orca workbench task submit [<task>] (--body <text> | --body-file <path|->) [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'task', 'body', 'body-file', 'workbench'],
    positionalArgs: ['task'],
    examples: [
      'orca workbench task submit --body-file "$TMPDIR/evidence.md"',
      'orca workbench task submit <task-id> --body-file evidence.md'
    ],
    notes: [
      'Without a task id, submits the running task in the workspace that contains the current directory.',
      'Evidence says what changed, which commands ran and their results, which acceptance criteria are met, and open questions.',
      'The task moves to review; only the user accepts it.'
    ]
  },
  {
    path: ['workbench', 'task', 'step'],
    summary: 'Mark a development step done at the current commit, or reopen it',
    usage: 'orca workbench task step <step> [--task <task>] [--undo] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'step', 'task', 'undo', 'workbench'],
    positionalArgs: ['step'],
    examples: ['orca workbench task step S2', 'orca workbench task step S2 --undo'],
    notes: [
      'Without --task, uses the running task in the workspace that contains the current directory.',
      'Commit the step first: the workspace must have no uncommitted changes, and the step records the commit.'
    ]
  },
  {
    path: ['workbench', 'note', 'propose'],
    summary: 'Propose an initiative note for the user to review in Workbench',
    usage:
      'orca workbench note propose --project <id> --title <title> (--body <text> | --body-file <path|->) [--note <id>] [--task <id>] [--reason <text>] [--json]',
    allowedFlags: [
      ...LOCAL_COMMAND_FLAGS,
      'project',
      'title',
      'body',
      'body-file',
      'note',
      'task',
      'reason',
      'workbench'
    ],
    examples: [
      'orca workbench note propose --project p1 --task t1 --title "Android testing" --body-file note.md --reason "Verified test commands"'
    ],
    notes: [
      '--project takes the initiative id.',
      'The note changes only after the user accepts the proposal. Pass --note to propose a replacement for an existing note.'
    ]
  },
  {
    path: ['workbench', 'outcome', 'propose'],
    summary: 'Propose a criterion or decision for an outcome’s checklist, for the user to accept',
    usage:
      'orca workbench outcome propose --kind <criterion|decision> --text <text> [--item <id>] [--reason <text>] [--outcome <id>] [--task <id>] [--json]',
    allowedFlags: [
      ...LOCAL_COMMAND_FLAGS,
      'kind',
      'text',
      'item',
      'reason',
      'outcome',
      'task',
      'workbench'
    ],
    examples: [
      'orca workbench outcome propose --kind decision --text "No retry on a failed upload" --reason "The user agreed in this session"',
      'orca workbench outcome propose --kind criterion --item <item-id> --text "A failed upload shows an error without retry"'
    ],
    notes: [
      'Without --outcome or --task, uses the outcome of the Workbench task open in the current workspace.',
      '--item rewrites that checklist item (ids are in `status`); without it, the item is new.',
      'The proposal waits in the outcome’s inbox. When the user accepts it, Workbench sends the change to every open session on the outcome.'
    ]
  },
  {
    path: ['workbench', 'personal-notes', 'list'],
    summary: 'List the user’s personal notes with their summaries and paths',
    usage: 'orca workbench personal-notes list [--repo <name>] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'repo'],
    examples: [
      'orca workbench personal-notes list',
      'orca workbench personal-notes list --repo android-box-office --json'
    ],
    notes: [
      '--repo keeps general notes and notes whose `applies` names that repository.',
      'Notes marked `agents: none` are never listed. Read a note by its path.'
    ]
  },
  {
    path: ['workbench', 'personal-notes', 'index'],
    summary: 'Regenerate INDEX.md in the personal notes folder',
    usage: 'orca workbench personal-notes index [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS],
    notes: ['Run after adding, moving, or changing the front matter of a note.']
  }
]

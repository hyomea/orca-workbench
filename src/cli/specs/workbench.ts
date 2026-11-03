import type { CommandSpec } from '../args'
import { LOCAL_COMMAND_FLAGS } from '../args'

export const WORKBENCH_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['workbench', 'status'],
    summary: 'Show Workbench projects, features, work items, tasks, and pending proposals',
    usage: 'orca workbench status [--project <id>] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'project'],
    examples: ['orca workbench status', 'orca workbench status --project p1 --json'],
    notes: ['--json returns the stored records, including ids and the revision for `apply`.']
  },
  {
    path: ['workbench', 'schema'],
    summary: 'Print the JSON Schema of Workbench commands accepted by `apply`',
    usage: 'orca workbench schema [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS]
  },
  {
    path: ['workbench', 'apply'],
    summary: 'Apply Workbench commands atomically, the same way the Projects page does',
    usage: 'orca workbench apply (--body <json> | --body-file <path|->) [--revision <n>] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'body', 'body-file', 'revision'],
    examples: ['orca workbench apply --body-file plan.json --json'],
    notes: [
      'The file holds {"steps":[{"ref":"feature","command":{...}}, ...]}. A later step uses "$ref:feature" for the id created by that step.',
      'Either every step applies or none does. Pass --revision from `status --json` to reject the batch if the data changed meanwhile.'
    ]
  },
  {
    path: ['workbench', 'task', 'start'],
    summary: 'Start a planned Workbench task in an existing workspace',
    usage: 'orca workbench task start <task> --worktree <selector> [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'task', 'worktree'],
    positionalArgs: ['task'],
    examples: [
      'orca workbench task start <task-id> --worktree path:/path/to/workspace --json',
      'orca workbench task start <task-id> --worktree branch:feature/ENG-123-fix --json'
    ],
    notes: [
      '--worktree accepts the same selectors as other worktree commands (path:, branch:, id:, active).',
      'The workspace must belong to a repository linked to the task’s project.'
    ]
  },
  {
    path: ['workbench', 'note', 'propose'],
    summary: 'Propose a project note for the user to review in Projects',
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
      'reason'
    ],
    examples: [
      'orca workbench note propose --project p1 --task t1 --title "Android testing" --body-file note.md --reason "Verified test commands"'
    ],
    notes: [
      'The note changes only after the user accepts the proposal. Pass --note to propose a replacement for an existing note.'
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

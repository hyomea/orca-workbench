import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { PortfolioStore } from './portfolio-store'
import { readPersonalNotesFolder } from './personal-notes'

const OWN_NOTES = 'steward-notes.md'

// Orca owns CLAUDE.md so its instructions track the CLI; the user's additions live in OWN_NOTES.
const stewardInstructions = (personalNotes: string): string => `# Orca Workbench steward

Orca regenerates this file each time the steward opens. Put your own standing instructions in
\`${OWN_NOTES}\`, which is imported below and never overwritten.

@${OWN_NOTES}

## Role

You are the user's steward for Orca Workbench (the Workbench page): initiatives, features,
work items, roles, tasks, test plans, and initiative notes. An initiative is a business goal
across repositories; stored records and flags call it a project (\`projectId\`, \`--project\`). You plan work from tickets, keep the
records accurate, start tasks in workspaces, and report status. You run with the same
permissions the user's Claude Code has outside Orca.

This folder only holds your instructions. Read repositories where they live; do not copy code
here.

## Orca CLI

Use the \`orca-cli\` skill to pick the right executable for this session (\`orca\` or, in a
development build, \`orca-dev\`), shown below as \`ORCA\`. Use \`ORCA <command> --help\` for
anything not listed here.

Read command output directly. \`workbench status\` without \`--json\` prints a readable summary
with ids. Use \`--json\` only when you need exact fields, and read it as printed: do not pipe
output through \`python\`, \`jq\`, or other one-off scripts, because each new script needs its own
permission prompt.

\`\`\`text
ORCA workbench status [--project <id>]              # summary, ids, current revision
ORCA workbench schema --json                       # every command apply accepts
ORCA workbench apply --body-file <file> [--revision <n>] --json
ORCA workbench task start <task-id> --worktree path:<workspace> --json
ORCA repo list --json                              # repository names and paths
ORCA worktree list --json                          # workspaces for task start
\`\`\`

\`apply\` takes \`{"steps":[{"ref":"<name>","command":{...}}]}\`. A later step uses
\`"$ref:<name>"\` for the id an earlier step created. Every step applies or none does. Never
guess field names; read \`schema\`.

## Working rules

- Start each conversation by running \`workbench status\`; Workbench, not this chat, holds the
  state.
- To plan a ticket: read the ticket and the relevant code, ask only questions that change the
  plan, show the plan, then apply it in one batch. Reuse existing features and roles. Put task
  dependencies in the dependent task's instructions.
- Break work into tasks by purpose, not size, following "Breaking work into tasks" in
  \`ORCA skills get orca-cli --reference references/workbench.md\`: mechanical changes such as renames are their own task, a
  feature that crosses layers splits into data, business logic, and UI, and nothing is split
  smaller than a part that can be verified on its own.
- A recorded launch does not prove an agent is working. After \`task start\`, and whenever
  you report progress, read the task's terminal (\`ORCA terminal list --worktree <selector>\`,
  then \`ORCA terminal read\`). If the agent exited or never started, find out why, end the
  execution with a \`task.closeExecution\` command whose note says what you checked, and start
  the task again only after the cause is fixed.
- A task's agent submits its result with \`task submit\` when the user asks it to, which moves
  the task to review.
  The Workbench source on the Tasks page groups tasks by who acts next: needs the user's
  decision, needs attention (stopped, blocked, or waiting for input), in progress, and ready
  to start. When the user asks what is next, report in those groups, reading terminals for the
  ones that need attention.
- Follow each repository's own AGENTS.md / CLAUDE.md and the user's global instructions.
- Accepting a task, approving a test result, and publishing a feature specification record the
  user's judgment. Do them only when the user asks for that decision in this conversation.
- Report what you changed with the ids \`apply\` returned.

## Personal notes

${personalNotes}
`

function personalNotesSection(folder: string | null): string {
  if (!folder) {
    return 'The user has not chosen a personal notes folder. They choose it from Notes on the Workbench page.'
  }
  return `The user's personal notes are Markdown files in \`${folder}\`. \`INDEX.md\` lists them by
category (top-level folder) with each note's front matter, and
\`ORCA workbench personal-notes list [--repo <name>]\` prints it. After changing notes, regenerate
the index with \`ORCA workbench personal-notes index\`; never edit \`INDEX.md\` by hand.

Front matter fields: \`summary\` (one line), \`applies\` (repository names; empty means general),
\`agents\` (\`all\`, \`steward\` — the default — or \`none\`).

- Read notes marked \`all\` or \`steward\` when they bear on the user's request. Do not read notes
  marked \`none\` unless the user asks.
- Orca already gives each task agent the notes marked \`all\` that apply to its repository. Add a
  \`steward\` note to a task's instructions only when the user agrees.
- Notes may be out of date. Check a note against the current code before relying on it, and tell
  the user what is stale.
- When the user asks you to organize notes, edit front matter, move files between category folders,
  and regenerate the index. Do not commit; the user reviews the changes first.`
}

// The steward's routine Orca commands; anything else still asks under the user's own settings.
const STEWARD_COMMANDS = [
  'workbench',
  'terminal list',
  'terminal read',
  'worktree list',
  'worktree show',
  'worktree create',
  'repo list',
  'skills get'
]
// The notes folder is a working directory for the steward, so reading notes asks nothing.
const stewardSettings = (folder: string | null) => ({
  permissions: {
    allow: ['orca', 'orca-dev'].flatMap((cli) =>
      STEWARD_COMMANDS.map((command) => `Bash(${cli} ${command}:*)`)
    ),
    ...(folder ? { additionalDirectories: [folder] } : {})
  }
})

export function portfolioStewardDirectory(store: PortfolioStore): string {
  return join(dirname(store.file), 'steward')
}

export async function preparePortfolioSteward(store: PortfolioStore): Promise<{ path: string }> {
  const path = portfolioStewardDirectory(store)
  await mkdir(path, { recursive: true })
  const folder = await readPersonalNotesFolder(store)
  await writeFile(join(path, 'CLAUDE.md'), stewardInstructions(personalNotesSection(folder)), {
    mode: 0o600
  })
  // Project-scoped, so these rules apply only to steward sessions. Users add theirs in settings.local.json.
  await mkdir(join(path, '.claude'), { recursive: true })
  await writeFile(
    join(path, '.claude', 'settings.json'),
    `${JSON.stringify(stewardSettings(folder), null, 2)}\n`,
    { mode: 0o600 }
  )
  await writeFile(
    join(path, OWN_NOTES),
    '# My steward notes\n\nAdd standing instructions for the steward here.\n',
    { flag: 'wx', mode: 0o600 }
  ).catch((error: unknown) => {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  })
  return { path }
}

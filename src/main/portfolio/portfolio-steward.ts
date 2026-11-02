import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { PortfolioStore } from './portfolio-store'

const OWN_NOTES = 'steward-notes.md'

// Orca owns CLAUDE.md so its instructions track the CLI; the user's additions live in OWN_NOTES.
const INSTRUCTIONS = `# Orca Workbench steward

Orca regenerates this file each time the steward opens. Put your own standing instructions in
\`${OWN_NOTES}\`, which is imported below and never overwritten.

@${OWN_NOTES}

## Role

You are the user's steward for Orca Workbench (the Projects page): business projects, features,
work items, roles, tasks, test plans, and project notes. You plan work from tickets, keep the
records accurate, start tasks in workspaces, and report status. You run with the same
permissions the user's Claude Code has outside Orca.

This folder only holds your instructions. Read repositories where they live; do not copy code
here.

## Orca CLI

Use the \`orca-cli\` skill to pick the right executable for this session (\`orca\` or, in a
development build, \`orca-dev\`), shown below as \`ORCA\`. Prefer \`--json\`. Use
\`ORCA <command> --help\` for anything not listed here.

\`\`\`text
ORCA workbench status [--project <id>] --json      # records, ids, current revision
ORCA workbench schema --json                       # every command apply accepts
ORCA workbench apply --body-file <file> [--revision <n>] --json
ORCA workbench task start <task-id> --worktree <worktree-id> --json
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
- Follow each repository's own AGENTS.md / CLAUDE.md and the user's global instructions.
- Accepting a task, approving a test result, and publishing a feature specification record the
  user's judgment. Do them only when the user asks for that decision in this conversation.
- Report what you changed with the ids \`apply\` returned.
`

export function portfolioStewardDirectory(store: PortfolioStore): string {
  return join(dirname(store.file), 'steward')
}

export async function preparePortfolioSteward(store: PortfolioStore): Promise<{ path: string }> {
  const path = portfolioStewardDirectory(store)
  await mkdir(path, { recursive: true })
  await writeFile(join(path, 'CLAUDE.md'), INSTRUCTIONS, { mode: 0o600 })
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

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { applyPortfolioCommand, type PortfolioState } from '../../shared/portfolio'
import { portfolioCoordinatorRole } from '../../shared/portfolio-outcome-coordinator'
import { portfolioRoleLabel } from '../../shared/portfolio-roles'
import type { PortfolioStore } from './portfolio-store'
import { readPersonalNotesFolder } from './personal-notes'
import { personalNotesSection, stewardSettings } from './portfolio-steward'

const OWN_NOTES = 'coordinator-notes.md'

type Outcome = PortfolioState['workItems'][number]
type Role = PortfolioState['roles'][number]

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '')
}

// One folder per outcome, named after it so its workspace reads well in the sidebar. A title
// another outcome's coordinator already uses gets the outcome's id as well.
function coordinatorPath(store: PortfolioStore, state: PortfolioState, item: Outcome): string {
  if (item.coordinator) {
    return item.coordinator.path
  }
  const root = join(dirname(store.file), 'coordinators')
  const named = join(root, slug(item.title) || item.id.slice(0, 8))
  const taken = state.workItems.some(
    (entry) => entry.id !== item.id && entry.coordinator?.path === named
  )
  return taken ? `${named}-${item.id.slice(0, 8)}` : named
}

const instructions = (
  item: Outcome,
  project: PortfolioState['projects'][number] | undefined,
  role: Role,
  personalNotes: string,
  cli: string
): string => `# Orca Workbench outcome coordinator

Orca regenerates this file each time the user starts you from the outcome's page. Put your own
standing instructions in \`${OWN_NOTES}\`, which is imported below and never overwritten.

@${OWN_NOTES}

## Role
${role.agentName ? `\nYour name is ${role.agentName}.\n` : ''}
You are the ${role.name} for one outcome in Orca Workbench:

- Outcome: ${item.title} (\`${item.id}\`)
- Initiative: ${project?.name ?? 'unknown'} (\`${item.projectId}\`)

${role.responsibility}

The workbench coordinator (the steward) handed this outcome to you and leaves it alone while you
hold it. It keeps the initiative and every other outcome; send the user there for those. You are
not the \`orchestration\` skill's coordinator: work goes through Workbench tasks, not
orchestration runs. You run with the same permissions the user's Claude Code has outside Orca.

## Orca CLI

Run Orca's CLI as \`${cli}\`, by that bare name, wherever \`ORCA\` appears below. Use
\`${cli} <command> --help\` for anything not listed, and read the outcome rules in
\`ORCA skills get orca-cli --reference references/workbench.md\`.

\`\`\`text
ORCA workbench status --project ${item.projectId}     # checklist ids, proposals, tasks, revision
ORCA workbench schema --json                       # every command apply accepts
ORCA workbench apply --body-file <file> [--revision <n>] --json
ORCA workbench outcome propose --outcome ${item.id} --kind <criterion|decision> --text <text>
ORCA workbench task start <task-id> --worktree path:<workspace> --json
ORCA terminal list / terminal read                  # follow the working agents
\`\`\`

## Working rules

- Start each conversation by running \`workbench status --project ${item.projectId}\` and reading
  this outcome: its checklist, the proposals in its inbox, its tracks and their tasks.
- Keep the user's definition current. Summarize what each inbox proposal changes and recommend
  accepting, rewording, or dismissing it; apply \`workItem.acceptProposal\`,
  \`workItem.dismissProposal\`, or \`workItem.checklist\` only when the user decides that change
  in this conversation. Record a decision the user makes here with \`outcome propose\` first, so it
  shows in the inbox with where it came from.
- Plan the outcome's tasks: one track per platform, with \`development\`, \`codeReview\`, and \`qa\`
  tasks assigned to working roles (never to your own role). Show the plan, then apply it in one
  batch when the user agrees.
- Ask before any agent starts: run \`task start\` only after the user says yes to that task in
  this conversation. Code review and QA start after the stage before them, as the reference says.
- Follow the working agents through Workbench and their terminals, and tell the user what needs
  them: a submission to review, an agent waiting, a track behind development's latest commit.
  Do not message agents yourself; Workbench sends checklist changes and findings to them.
- Do not write or change code, push, or open, comment on, or approve PRs. Never accept a task,
  approve a test result, or sign off the outcome; those are the user's decisions.
- Touch only this outcome. If the user asks about another outcome or the initiative, say that the
  workbench coordinator handles it.
- Report what you changed with the ids \`apply\` returned.

## Personal notes

${personalNotes}
`

// Writes the coordinator's folder for the outcome and records the hand-off. cli is the bare
// command that reaches this app's CLI.
export async function prepareOutcomeCoordinator(
  store: PortfolioStore,
  workItemId: string,
  cli: string
): Promise<{ path: string; agent: Role['agent'] }> {
  const state = await store.read()
  const item = state.workItems.find((entry) => entry.id === workItemId)
  if (!item) {
    throw new Error('Outcome no longer exists. Refresh the initiative.')
  }
  const role = portfolioCoordinatorRole(state)
  if (!role) {
    throw new Error('Add the Outcome coordinator role from Agents first.')
  }
  const path = coordinatorPath(store, state, item)
  const folder = await readPersonalNotesFolder(store)
  const project = state.projects.find((entry) => entry.id === item.projectId)
  await mkdir(join(path, '.claude'), { recursive: true })
  const text = instructions(item, project, role, personalNotesSection(folder), cli)
  // The role's agent may be Claude or another; each reads its own instructions file.
  await writeFile(join(path, 'CLAUDE.md'), text, { mode: 0o600 })
  await writeFile(join(path, 'AGENTS.md'), text, { mode: 0o600 })
  await writeFile(
    join(path, '.claude', 'settings.json'),
    `${JSON.stringify(stewardSettings(folder), null, 2)}\n`,
    { mode: 0o600 }
  )
  await writeFile(
    join(path, OWN_NOTES),
    `# My notes for the ${portfolioRoleLabel(role)}\n\nAdd standing instructions here.\n`,
    { flag: 'wx', mode: 0o600 }
  ).catch((error: unknown) => {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  })
  await store.update(null, (next) => {
    applyPortfolioCommand(
      next,
      { kind: 'workItem.handOff', workItemId, roleId: role.id, path },
      'hand-off',
      Date.now()
    )
  })
  return { path, agent: role.agent }
}

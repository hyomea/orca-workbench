import type { CommandHandler, HandlerContext } from '../dispatch'
import { readCommandBody } from '../command-body-input'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { getRequiredWorktreeSelector, resolveCurrentWorktreeSelection } from '../selectors'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { z } from 'zod'
import {
  PortfolioCommand,
  PortfolioCommit,
  type PortfolioState,
  type PortfolioTask
} from '../../shared/portfolio'
import { MAX_PORTFOLIO_NOTE_CHARACTERS } from '../../shared/portfolio-notes'
import { RuntimeClientError } from '../runtime-client'
import { portfolioRoleLabel } from '../../shared/portfolio-roles'
import type { GitStatusResult } from '../../shared/git-status-types'

// Matches the stored limit for a task transition note.
const MAX_PORTFOLIO_EVIDENCE_CHARACTERS = 20_000
const LOCAL_ONLY = 'workbench commands; initiatives are stored on this computer.'

async function read(ctx: HandlerContext): Promise<PortfolioState> {
  return (await ctx.client.call<PortfolioState>('portfolio.read', {})).result
}

async function status(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const response = await ctx.client.call<PortfolioState>('portfolio.read', {})
  const projectId = getOptionalStringFlag(ctx.flags, 'project')
  const state = response.result
  if (projectId && !state.projects.some((project) => project.id === projectId)) {
    throw new RuntimeClientError('invalid_argument', `No Workbench project has id ${projectId}.`)
  }
  const inProject = <T extends { projectId: string }>(entries: T[]) =>
    projectId ? entries.filter((entry) => entry.projectId === projectId) : entries
  const features = inProject(state.features)
  const scoped = {
    ...state,
    projects: projectId
      ? state.projects.filter((project) => project.id === projectId)
      : state.projects,
    features,
    workItems: inProject(state.workItems),
    tasks: inProject(state.tasks),
    notes: inProject(state.notes),
    noteDrafts: inProject(state.noteDrafts)
  }
  printResult({ ...response, result: scoped }, ctx.json, formatStatus)
}

function formatStatus(state: PortfolioState): string {
  const lines = [`Revision ${state.revision}`]
  for (const project of state.projects) {
    lines.push('', `Initiative ${project.name} [${project.id}]`)
    const features = state.features.filter((feature) => feature.projectId === project.id)
    for (const item of state.workItems.filter((entry) => entry.projectId === project.id)) {
      const details = [
        item.kind,
        item.status,
        ...(item.parity ? ['same on iOS and Android'] : []),
        ...(item.featureId
          ? [`feature ${features.find((feature) => feature.id === item.featureId)?.name}`]
          : [])
      ]
      lines.push(`  Outcome (${details.join(', ')}) ${item.title} [${item.id}]`)
      for (const ticket of item.tickets) {
        lines.push(`    Ticket ${ticket.platform ?? 'other'}: ${ticket.reference || 'none yet'}`)
      }
    }
    for (const feature of features) {
      lines.push(
        `  Feature ${feature.name} (specification v${feature.versions.at(-1)?.version ?? 0}) [${feature.id}]`
      )
    }
    for (const task of state.tasks.filter((entry) => entry.projectId === project.id)) {
      const found = state.roles.find((entry) => entry.id === task.roleId)
      const role = found ? portfolioRoleLabel(found) : 'unknown role'
      lines.push(
        `  Task (${task.status}${task.platform ? `, ${task.platform}` : ''}) ${task.title} · ${role} [${task.id}]${task.workItemId ? ` → ${task.workItemId}` : ''}`
      )
    }
    const notes = state.notes.filter((note) => note.projectId === project.id).length
    const drafts = state.noteDrafts.filter((draft) => draft.projectId === project.id).length
    lines.push(`  Notes ${notes} · pending note proposals ${drafts}`)
  }
  lines.push(
    '',
    `Roles: ${state.roles.map((role) => `${portfolioRoleLabel(role)} (${role.agent}) [${role.id}]`).join(', ') || 'none'}`
  )
  return lines.join('\n')
}

async function schema(ctx: HandlerContext): Promise<void> {
  console.log(
    JSON.stringify(z.toJSONSchema(PortfolioCommand, { io: 'input' }), null, ctx.json ? 2 : 0)
  )
}

async function apply(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const text = await readCommandBody(ctx.flags, ctx.cwd, {
    required: true,
    maximumCharacters: 2_000_000,
    tooLargeCode: 'workbench_batch_too_large',
    label: 'Workbench batch'
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new RuntimeClientError('invalid_argument', 'The batch is not valid JSON.')
  }
  const steps = Array.isArray(parsed) ? parsed : (parsed as { steps?: unknown } | null)?.steps
  const revision = getOptionalStringFlag(ctx.flags, 'revision')
  const response = await ctx.client.call<{ revision: number; refs: Record<string, string> }>(
    'portfolio.batch',
    { steps, ...(revision === undefined ? {} : { revision: Number(revision) }) }
  )
  printResult(response, ctx.json, (result) =>
    [
      `Applied. Revision ${result.revision}.`,
      ...Object.entries(result.refs).map(([ref, id]) => `  ${ref}: ${id}`)
    ].join('\n')
  )
}

async function startTask(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const taskId = getRequiredStringFlag(ctx.flags, 'task')
  // Accept any worktree selector, like other worktree commands; launch takes the resolved id.
  const { worktree } = (
    await ctx.client.call<{ worktree: { id: string } }>('worktree.show', {
      worktree: await getRequiredWorktreeSelector(ctx.flags, 'worktree', ctx.cwd, ctx.client)
    })
  ).result
  const state = await read(ctx)
  const response = await ctx.client.call<PortfolioState>('portfolio.launch', {
    revision: state.revision,
    taskId,
    worktreeId: worktree.id
  })
  printResult(response, ctx.json, (next) => {
    const attempt = next.tasks.find((task) => task.id === taskId)?.attempts.at(-1)
    return `Task started (${attempt?.state ?? 'unknown'}).${attempt?.warning ? ` ${attempt.warning}` : ''}`
  })
}

// Without an id, the task is the one running in the caller's workspace; agents rarely keep the id.
async function submittedTask(ctx: HandlerContext, state: PortfolioState): Promise<PortfolioTask> {
  const taskId = getOptionalStringFlag(ctx.flags, 'task')
  if (taskId) {
    const task = state.tasks.find((entry) => entry.id === taskId)
    if (!task) {
      throw new RuntimeClientError('invalid_argument', `No Workbench task has id ${taskId}.`)
    }
    return task
  }
  const { worktreeId } = await resolveCurrentWorktreeSelection(ctx.cwd, ctx.client)
  const running = state.tasks.filter(
    (task) => task.status === 'running' && task.attempts.at(-1)?.worktreeId === worktreeId
  )
  if (running.length !== 1) {
    throw new RuntimeClientError(
      'invalid_argument',
      running.length === 0
        ? 'No running Workbench task uses this workspace. Pass the task id.'
        : `Several running Workbench tasks use this workspace (${running.map((task) => task.id).join(', ')}). Pass the task id.`
    )
  }
  return running[0]
}

// The user reviews a fixed version: everything must be committed, and that commit is recorded.
async function submittedCommit(ctx: HandlerContext, task: PortfolioTask): Promise<string> {
  const worktreeId = task.attempts.at(-1)?.worktreeId
  if (!worktreeId) {
    throw new RuntimeClientError('invalid_argument', `Task ${task.id} has no workspace.`)
  }
  const { result } = await ctx.client.call<GitStatusResult>('git.status', {
    worktree: `id:${worktreeId}`
  })
  // Porcelain reports "(initial)" before the first commit.
  if (result.readError || !PortfolioCommit.safeParse(result.head).success) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Cannot read the task workspace's Git state: ${result.readError ?? 'no commit is checked out'}.`
    )
  }
  if (result.entries.length > 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      `The task workspace has ${result.entries.length} uncommitted change(s). Commit the work on the task branch, then submit again.`
    )
  }
  return result.head as string
}

async function submitTask(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const evidence = await readCommandBody(ctx.flags, ctx.cwd, {
    required: true,
    maximumCharacters: MAX_PORTFOLIO_EVIDENCE_CHARACTERS,
    tooLargeCode: 'evidence_too_large',
    label: 'Evidence'
  })
  const state = await read(ctx)
  const task = await submittedTask(ctx, state)
  const taskId = task.id
  // Only work in progress is submitted; a planned or decided task is the user's to move.
  if (task.status !== 'running') {
    throw new RuntimeClientError(
      'invalid_argument',
      `Task ${taskId} is ${task.status}; only a running task can be submitted for review.`
    )
  }
  const commit = await submittedCommit(ctx, task)
  const response = await ctx.client.call<PortfolioState>('portfolio.mutate', {
    revision: state.revision,
    command: { kind: 'task.transition', taskId, status: 'review', note: evidence, commit }
  })
  printResult(
    response,
    ctx.json,
    () => 'Submitted for review. The user decides whether to accept it.'
  )
}

async function propose(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const body = await readCommandBody(ctx.flags, ctx.cwd, {
    required: true,
    maximumCharacters: MAX_PORTFOLIO_NOTE_CHARACTERS,
    tooLargeCode: 'note_body_too_large',
    label: 'Note body'
  })
  const noteId = getOptionalStringFlag(ctx.flags, 'note')
  const taskId = getOptionalStringFlag(ctx.flags, 'task')
  const response = await ctx.client.call<{ draftId: string }>('portfolio.proposeNote', {
    draft: {
      projectId: getRequiredStringFlag(ctx.flags, 'project'),
      title: getRequiredStringFlag(ctx.flags, 'title'),
      body,
      reason: getOptionalStringFlag(ctx.flags, 'reason') ?? '',
      ...(noteId ? { noteId } : {}),
      ...(taskId ? { taskId } : {})
    }
  })
  printResult(response, ctx.json, () => 'Note proposal submitted for review in Workbench.')
}

type PersonalNoteRow = {
  title: string
  path: string
  category: string
  summary: string
  applies: string[]
  agents: string
  problem?: string
}

async function listPersonalNotes(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const repo = getOptionalStringFlag(ctx.flags, 'repo')
  const response = await ctx.client.call<{ folder: string | null; notes: PersonalNoteRow[] }>(
    'portfolio.personalNotes',
    repo ? { repo } : {}
  )
  printResult(response, ctx.json, ({ folder, notes }) => {
    if (!folder) {
      return 'No personal notes folder is set. The user chooses it from Notes on the Workbench page.'
    }
    const lines = [`Personal notes in ${folder}`]
    for (const note of notes) {
      const scope = note.applies.length ? note.applies.join(', ') : 'general'
      lines.push(
        `- ${note.title} (${note.category || 'General'}; ${scope}; agents: ${note.agents})${note.summary ? ` — ${note.summary}` : ''}`,
        `  ${note.path}${note.problem ? `\n  ⚠ ${note.problem}` : ''}`
      )
    }
    return lines.join('\n')
  })
}

async function indexNotes(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const response = await ctx.client.call<{ indexPath: string; notes: unknown[] }>(
    'portfolio.indexPersonalNotes',
    {}
  )
  printResult(
    response,
    ctx.json,
    ({ indexPath, notes }) => `Indexed ${notes.length} notes in ${indexPath}`
  )
}

export const WORKBENCH_HANDLERS: Record<string, CommandHandler> = {
  'workbench status': status,
  'workbench schema': schema,
  'workbench apply': apply,
  'workbench task start': startTask,
  'workbench task submit': submitTask,
  'workbench note propose': propose,
  'workbench personal-notes list': listPersonalNotes,
  'workbench personal-notes index': indexNotes
}

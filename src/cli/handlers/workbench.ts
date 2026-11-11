import type { CommandHandler, HandlerContext } from '../dispatch'
import { readCommandBody } from '../command-body-input'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { z } from 'zod'
import { PortfolioCommand, type PortfolioState } from '../../shared/portfolio'
import { MAX_PORTFOLIO_NOTE_CHARACTERS } from '../../shared/portfolio-notes'
import { RuntimeClientError } from '../runtime-client'
import { portfolioRoleLabel } from '../../shared/portfolio-roles'
import { PORTFOLIO_STAGE_NAMES } from '../../shared/portfolio-task-stages'
import { WORKBENCH_TASK_HANDLERS } from './workbench-tasks'
import { WORKBENCH_OUTCOME_HANDLERS } from './workbench-outcomes'
import { WORKBENCH_COORDINATOR_HANDLERS } from './workbench-coordinator'
import { portfolioChecklist } from '../../shared/portfolio-checklist'
import { LOCAL_ONLY, workbenchScope } from './workbench-client'
import type { PortfolioWorkbenchSummary } from '../../shared/rpc-contract/portfolio-params'

async function status(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const response = await ctx.client.call<PortfolioState>(
    'portfolio.read',
    await workbenchScope(ctx)
  )
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
  const lines = [`Workbench ${state.organization} · Revision ${state.revision}`]
  for (const project of state.projects) {
    lines.push('', `Initiative ${project.name} [${project.id}]`)
    const features = state.features.filter((feature) => feature.projectId === project.id)
    for (const item of state.workItems.filter((entry) => entry.projectId === project.id)) {
      const details = [
        item.kind,
        // Only sign-off is stored; the tasks below show how far the work has come.
        item.status === 'accepted' ? 'signed off' : 'open',
        ...(item.parity ? ['same on iOS and Android'] : []),
        ...(item.featureId
          ? [`feature ${features.find((feature) => feature.id === item.featureId)?.name}`]
          : [])
      ]
      lines.push(`  Outcome (${details.join(', ')}) ${item.title} [${item.id}]`)
      if (item.coordinator) {
        const role = state.roles.find((entry) => entry.id === item.coordinator?.roleId)
        lines.push(
          `    Coordinator: ${role ? portfolioRoleLabel(role) : 'Outcome coordinator'} holds this outcome`
        )
      }
      for (const ticket of item.tickets) {
        const role = ticket.role && ticket.role !== 'author' ? ` (user is ${ticket.role})` : ''
        lines.push(
          `    Ticket ${ticket.platform ?? 'other'}${role}: ${ticket.reference || 'none yet'}${ticket.pr ? ` · PR ${ticket.pr}` : ''}`
        )
      }
      for (const entry of portfolioChecklist(item)) {
        lines.push(
          `    ${entry.kind === 'decision' ? 'Decision' : 'Criterion'}: ${entry.text} [${entry.id}]`
        )
      }
      for (const proposal of item.proposals ?? []) {
        lines.push(
          `    Proposed ${proposal.kind}${proposal.itemId ? ` for ${proposal.itemId}` : ''}: ${proposal.text}`
        )
      }
    }
    for (const feature of features) {
      const parity = feature.parity
        ? `iOS ${feature.parity.ios.status}, Android ${feature.parity.android.status}`
        : 'parity not checked'
      lines.push(
        `  Feature ${feature.name} (specification v${feature.versions.at(-1)?.version ?? 0}, ${parity}) [${feature.id}]`
      )
    }
    for (const task of state.tasks.filter((entry) => entry.projectId === project.id)) {
      const found = state.roles.find((entry) => entry.id === task.roleId)
      const role = found ? portfolioRoleLabel(found) : 'unknown role'
      const done = task.steps.filter((step) => step.done).length
      const details = [
        PORTFOLIO_STAGE_NAMES[task.stage],
        task.status,
        ...(task.platform ? [task.platform] : []),
        ...(task.steps.length ? [`steps ${done}/${task.steps.length}`] : [])
      ]
      lines.push(
        `  Task (${details.join(', ')}) ${task.title} · ${role} [${task.id}]${task.workItemId ? ` → ${task.workItemId}` : ''}`
      )
      for (const step of task.steps) {
        lines.push(
          `    [${step.done ? 'x' : ' '}] ${step.title} [${step.id}]${step.commit ? ` @ ${step.commit}` : ''}`
        )
      }
    }
    const notes = state.notes.filter((note) => note.projectId === project.id).length
    const drafts = state.noteDrafts.filter((draft) => draft.projectId === project.id).length
    lines.push(`  Notes ${notes} · pending note proposals ${drafts}`)
  }
  lines.push(
    '',
    `Roles: ${state.roles.map((role) => `${portfolioRoleLabel(role)} (${role.coordinator ? 'outcome coordinator, ' : ''}${role.agent}) [${role.id}]`).join(', ') || 'none'}`
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
    {
      ...(await workbenchScope(ctx)),
      steps,
      ...(revision === undefined ? {} : { revision: Number(revision) })
    }
  )
  printResult(response, ctx.json, (result) =>
    [
      `Applied. Revision ${result.revision}.`,
      ...Object.entries(result.refs).map(([ref, id]) => `  ${ref}: ${id}`)
    ].join('\n')
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
    ...(await workbenchScope(ctx)),
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

async function list(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const response = await ctx.client.call<PortfolioWorkbenchSummary[]>('portfolio.workbenches', {})
  printResult(response, ctx.json, (entries) =>
    entries.map((entry) => `${entry.name} [${entry.id}]`).join('\n')
  )
}

export const WORKBENCH_HANDLERS: Record<string, CommandHandler> = {
  'workbench list': list,
  'workbench status': status,
  'workbench schema': schema,
  'workbench apply': apply,
  ...WORKBENCH_TASK_HANDLERS,
  'workbench note propose': propose,
  ...WORKBENCH_OUTCOME_HANDLERS,
  ...WORKBENCH_COORDINATOR_HANDLERS,
  'workbench personal-notes list': listPersonalNotes,
  'workbench personal-notes index': indexNotes
}

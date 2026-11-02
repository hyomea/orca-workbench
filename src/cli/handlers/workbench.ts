import type { CommandHandler, HandlerContext } from '../dispatch'
import { readCommandBody } from '../command-body-input'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { z } from 'zod'
import { PortfolioCommand, type PortfolioState } from '../../shared/portfolio'
import { MAX_PORTFOLIO_NOTE_CHARACTERS } from '../../shared/portfolio-notes'
import { RuntimeClientError } from '../runtime-client'

const LOCAL_ONLY = 'workbench commands; projects are stored on this computer.'

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
    workItems: state.workItems.filter((item) => features.some((f) => f.id === item.featureId)),
    tasks: inProject(state.tasks),
    notes: inProject(state.notes),
    noteDrafts: inProject(state.noteDrafts)
  }
  printResult({ ...response, result: scoped }, ctx.json, formatStatus)
}

function formatStatus(state: PortfolioState): string {
  const lines = [`Revision ${state.revision}`]
  for (const project of state.projects) {
    lines.push('', `Project ${project.name} [${project.id}]`)
    for (const feature of state.features.filter((f) => f.projectId === project.id)) {
      lines.push(`  Feature ${feature.name} [${feature.id}]`)
      for (const item of state.workItems.filter((entry) => entry.featureId === feature.id)) {
        lines.push(`    Work item (${item.kind}, ${item.status}) ${item.title} [${item.id}]`)
      }
    }
    for (const task of state.tasks.filter((entry) => entry.projectId === project.id)) {
      const role = state.roles.find((entry) => entry.id === task.roleId)?.name ?? 'unknown role'
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
    `Roles: ${state.roles.map((role) => `${role.name} (${role.agent}) [${role.id}]`).join(', ') || 'none'}`
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
  const state = await read(ctx)
  const response = await ctx.client.call<PortfolioState>('portfolio.launch', {
    revision: state.revision,
    taskId,
    worktreeId: getRequiredStringFlag(ctx.flags, 'worktree')
  })
  printResult(response, ctx.json, (next) => {
    const attempt = next.tasks.find((task) => task.id === taskId)?.attempts.at(-1)
    return `Task started (${attempt?.state ?? 'unknown'}).${attempt?.warning ? ` ${attempt.warning}` : ''}`
  })
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
  printResult(response, ctx.json, () => 'Note proposal submitted for review in Projects.')
}

export const WORKBENCH_HANDLERS: Record<string, CommandHandler> = {
  'workbench status': status,
  'workbench schema': schema,
  'workbench apply': apply,
  'workbench task start': startTask,
  'workbench note propose': propose
}
